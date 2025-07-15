const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  content: {
    type: String,
    required: function() {
      return !this.voiceNote && !this.image;
    },
    maxlength: 1000
  },
  messageType: {
    type: String,
    enum: ['text', 'voice', 'image', 'location', 'resource_share'],
    default: 'text'
  },
  voiceNote: {
    url: String,
    publicId: String,
    duration: Number // in seconds
  },
  image: {
    url: String,
    publicId: String,
    caption: String
  },
  location: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: [Number],
    address: String
  },
  sharedResource: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Resource'
  },
  // Message status
  status: {
    type: String,
    enum: ['sent', 'delivered', 'read'],
    default: 'sent'
  },
  // Read receipts
  readBy: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    readAt: {
      type: Date,
      default: Date.now
    }
  }],
  // Translation support
  language: {
    type: String,
    default: 'en'
  },
  translations: [{
    language: String,
    content: String,
    translatedAt: {
      type: Date,
      default: Date.now
    }
  }],
  // Message reactions
  reactions: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    emoji: String,
    addedAt: {
      type: Date,
      default: Date.now
    }
  }],
  // Reply to another message
  replyTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message'
  },
  // Edited message tracking
  isEdited: {
    type: Boolean,
    default: false
  },
  editedAt: Date,
  originalContent: String
}, {
  timestamps: true
});

const chatSchema = new mongoose.Schema({
  chatType: {
    type: String,
    enum: ['direct', 'group', 'resource_discussion', 'challenge_chat'],
    required: true
  },
  participants: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    role: {
      type: String,
      enum: ['member', 'admin', 'moderator'],
      default: 'member'
    },
    joinedAt: {
      type: Date,
      default: Date.now
    },
    lastSeen: {
      type: Date,
      default: Date.now
    },
    // Notification preferences for this chat
    notificationsEnabled: {
      type: Boolean,
      default: true
    },
    // Accessibility settings
    accessibilityMode: {
      type: String,
      enum: ['default', 'high_contrast', 'large_text', 'screen_reader'],
      default: 'default'
    }
  }],
  // Group chat specific fields
  groupName: {
    type: String,
    trim: true,
    maxlength: 100
  },
  groupDescription: {
    type: String,
    maxlength: 500
  },
  groupImage: {
    url: String,
    publicId: String
  },
  // Resource-related chat
  relatedResource: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Resource'
  },
  // Challenge-related chat
  relatedChallenge: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Challenge'
  },
  // Messages in this chat
  messages: [messageSchema],
  // Chat settings
  settings: {
    allowVoiceMessages: {
      type: Boolean,
      default: true
    },
    allowImageSharing: {
      type: Boolean,
      default: true
    },
    allowLocationSharing: {
      type: Boolean,
      default: true
    },
    autoTranslate: {
      type: Boolean,
      default: false
    },
    defaultLanguage: {
      type: String,
      default: 'en'
    }
  },
  // Chat status
  isActive: {
    type: Boolean,
    default: true
  },
  // Last message info for quick access
  lastMessage: {
    content: String,
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    sentAt: Date,
    messageType: String
  },
  // Unread message count per participant
  unreadCounts: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    count: {
      type: Number,
      default: 0
    }
  }],
  // Chat archived status
  archivedBy: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    archivedAt: {
      type: Date,
      default: Date.now
    }
  }]
}, {
  timestamps: true
});

// Create indexes for better performance
chatSchema.index({ participants: 1 });
chatSchema.index({ chatType: 1, isActive: 1 });
chatSchema.index({ relatedResource: 1 });
chatSchema.index({ relatedChallenge: 1 });
chatSchema.index({ 'lastMessage.sentAt': -1 });

// Message-specific indexes
messageSchema.index({ sender: 1 });
messageSchema.index({ createdAt: -1 });
messageSchema.index({ messageType: 1 });

// Method to add a message to chat
chatSchema.methods.addMessage = function(messageData) {
  const message = this.messages.create(messageData);
  this.messages.push(message);
  
  // Update last message info
  this.lastMessage = {
    content: messageData.content || `${messageData.messageType} message`,
    sender: messageData.sender,
    sentAt: new Date(),
    messageType: messageData.messageType
  };
  
  // Update unread counts for other participants
  this.unreadCounts.forEach(count => {
    if (count.user.toString() !== messageData.sender.toString()) {
      count.count += 1;
    }
  });
  
  return this.save();
};

// Method to mark messages as read
chatSchema.methods.markAsRead = function(userId, messageId = null) {
  if (messageId) {
    const message = this.messages.id(messageId);
    if (message) {
      const existingReadReceipt = message.readBy.find(
        r => r.user.toString() === userId.toString()
      );
      if (!existingReadReceipt) {
        message.readBy.push({ user: userId });
      }
    }
  } else {
    // Mark all messages as read for this user
    this.messages.forEach(message => {
      const existingReadReceipt = message.readBy.find(
        r => r.user.toString() === userId.toString()
      );
      if (!existingReadReceipt) {
        message.readBy.push({ user: userId });
      }
    });
  }
  
  // Reset unread count for this user
  const userUnreadCount = this.unreadCounts.find(
    count => count.user.toString() === userId.toString()
  );
  if (userUnreadCount) {
    userUnreadCount.count = 0;
  }
  
  return this.save();
};

// Method to get unread message count for a user
chatSchema.methods.getUnreadCount = function(userId) {
  const userUnreadCount = this.unreadCounts.find(
    count => count.user.toString() === userId.toString()
  );
  return userUnreadCount ? userUnreadCount.count : 0;
};

// Static method to find user's chats
chatSchema.statics.findUserChats = function(userId) {
  return this.find({
    'participants.user': userId,
    isActive: true
  }).populate('participants.user', 'username profilePicture isOnline')
    .populate('lastMessage.sender', 'username')
    .sort({ 'lastMessage.sentAt': -1 });
};

module.exports = mongoose.model('Chat', chatSchema);