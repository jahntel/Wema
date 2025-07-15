const Chat = require('../models/Chat');
const User = require('../models/User');
const jwt = require('jsonwebtoken');

// Socket authentication middleware
const authenticateSocket = async (socket, next) => {
  try {
    const token = socket.handshake.auth.token;
    
    if (!token) {
      return next(new Error('Authentication error'));
    }
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    const user = await User.findById(decoded.userId);
    
    if (!user) {
      return next(new Error('User not found'));
    }
    
    socket.user = user;
    next();
  } catch (error) {
    next(new Error('Authentication error'));
  }
};

const chatHandler = (socket, io) => {
  // Authenticate socket connection
  socket.use(authenticateSocket);
  
  // Join user to their personal room
  socket.join(`user:${socket.user._id}`);
  
  // Update user online status
  socket.user.isOnline = true;
  socket.user.save();
  
  // Notify other users that this user is online
  socket.broadcast.emit('user_online', {
    userId: socket.user._id,
    username: socket.user.username
  });
  
  // Join chat room
  socket.on('join_chat', async (chatId) => {
    try {
      const chat = await Chat.findById(chatId);
      
      if (!chat) {
        return socket.emit('error', { message: 'Chat not found' });
      }
      
      // Check if user is participant
      const isParticipant = chat.participants.some(
        p => p.user.toString() === socket.user._id.toString()
      );
      
      if (!isParticipant) {
        return socket.emit('error', { message: 'Not authorized to join this chat' });
      }
      
      socket.join(`chat:${chatId}`);
      
      // Update last seen
      const participant = chat.participants.find(
        p => p.user.toString() === socket.user._id.toString()
      );
      
      if (participant) {
        participant.lastSeen = new Date();
        await chat.save();
      }
      
      socket.emit('joined_chat', { chatId });
      
    } catch (error) {
      socket.emit('error', { message: 'Error joining chat' });
    }
  });
  
  // Leave chat room
  socket.on('leave_chat', (chatId) => {
    socket.leave(`chat:${chatId}`);
    socket.emit('left_chat', { chatId });
  });
  
  // Send message
  socket.on('send_message', async (data) => {
    try {
      const { chatId, content, messageType = 'text', voiceNote, image, location, replyTo } = data;
      
      const chat = await Chat.findById(chatId);
      
      if (!chat) {
        return socket.emit('error', { message: 'Chat not found' });
      }
      
      // Check if user is participant
      const isParticipant = chat.participants.some(
        p => p.user.toString() === socket.user._id.toString()
      );
      
      if (!isParticipant) {
        return socket.emit('error', { message: 'Not authorized to send messages' });
      }
      
      // Create message data
      const messageData = {
        sender: socket.user._id,
        content,
        messageType,
        language: socket.user.preferredLanguage
      };
      
      // Add optional fields
      if (voiceNote) messageData.voiceNote = voiceNote;
      if (image) messageData.image = image;
      if (location) messageData.location = location;
      if (replyTo) messageData.replyTo = replyTo;
      
      // Add message to chat
      await chat.addMessage(messageData);
      
      // Populate sender info for broadcast
      await chat.populate('messages.sender', 'username profilePicture');
      
      const newMessage = chat.messages[chat.messages.length - 1];
      
      // Broadcast message to all participants
      io.to(`chat:${chatId}`).emit('new_message', {
        chatId,
        message: newMessage
      });
      
      // Send push notifications to offline participants
      const offlineParticipants = chat.participants.filter(p => 
        p.user.toString() !== socket.user._id.toString()
      );
      
      for (const participant of offlineParticipants) {
        const user = await User.findById(participant.user);
        
        if (!user.isOnline && user.notificationPreferences.push) {
          // Send push notification (implement with your preferred service)
          io.to(`user:${user._id}`).emit('notification', {
            type: 'new_message',
            title: `New message from ${socket.user.username}`,
            body: content || `${messageType} message`,
            chatId
          });
        }
      }
      
    } catch (error) {
      socket.emit('error', { message: 'Error sending message' });
    }
  });
  
  // Mark messages as read
  socket.on('mark_as_read', async (data) => {
    try {
      const { chatId, messageId } = data;
      
      const chat = await Chat.findById(chatId);
      
      if (!chat) {
        return socket.emit('error', { message: 'Chat not found' });
      }
      
      await chat.markAsRead(socket.user._id, messageId);
      
      // Notify other participants about read receipt
      socket.to(`chat:${chatId}`).emit('message_read', {
        chatId,
        messageId,
        readBy: socket.user._id
      });
      
    } catch (error) {
      socket.emit('error', { message: 'Error marking message as read' });
    }
  });
  
  // Add reaction to message
  socket.on('add_reaction', async (data) => {
    try {
      const { chatId, messageId, emoji } = data;
      
      const chat = await Chat.findById(chatId);
      
      if (!chat) {
        return socket.emit('error', { message: 'Chat not found' });
      }
      
      const message = chat.messages.id(messageId);
      
      if (!message) {
        return socket.emit('error', { message: 'Message not found' });
      }
      
      // Check if user already reacted with this emoji
      const existingReaction = message.reactions.find(
        r => r.user.toString() === socket.user._id.toString() && r.emoji === emoji
      );
      
      if (existingReaction) {
        // Remove reaction
        message.reactions.pull(existingReaction);
      } else {
        // Add reaction
        message.reactions.push({
          user: socket.user._id,
          emoji
        });
      }
      
      await chat.save();
      
      // Broadcast reaction update
      io.to(`chat:${chatId}`).emit('reaction_updated', {
        chatId,
        messageId,
        reactions: message.reactions
      });
      
    } catch (error) {
      socket.emit('error', { message: 'Error adding reaction' });
    }
  });
  
  // Start typing indicator
  socket.on('start_typing', (data) => {
    const { chatId } = data;
    
    socket.to(`chat:${chatId}`).emit('user_typing', {
      chatId,
      userId: socket.user._id,
      username: socket.user.username
    });
  });
  
  // Stop typing indicator
  socket.on('stop_typing', (data) => {
    const { chatId } = data;
    
    socket.to(`chat:${chatId}`).emit('user_stopped_typing', {
      chatId,
      userId: socket.user._id
    });
  });
  
  // Edit message
  socket.on('edit_message', async (data) => {
    try {
      const { chatId, messageId, newContent } = data;
      
      const chat = await Chat.findById(chatId);
      
      if (!chat) {
        return socket.emit('error', { message: 'Chat not found' });
      }
      
      const message = chat.messages.id(messageId);
      
      if (!message) {
        return socket.emit('error', { message: 'Message not found' });
      }
      
      // Check if user owns the message
      if (message.sender.toString() !== socket.user._id.toString()) {
        return socket.emit('error', { message: 'Not authorized to edit this message' });
      }
      
      // Update message
      message.originalContent = message.content;
      message.content = newContent;
      message.isEdited = true;
      message.editedAt = new Date();
      
      await chat.save();
      
      // Broadcast message update
      io.to(`chat:${chatId}`).emit('message_edited', {
        chatId,
        messageId,
        newContent,
        editedAt: message.editedAt
      });
      
    } catch (error) {
      socket.emit('error', { message: 'Error editing message' });
    }
  });
  
  // Delete message
  socket.on('delete_message', async (data) => {
    try {
      const { chatId, messageId } = data;
      
      const chat = await Chat.findById(chatId);
      
      if (!chat) {
        return socket.emit('error', { message: 'Chat not found' });
      }
      
      const message = chat.messages.id(messageId);
      
      if (!message) {
        return socket.emit('error', { message: 'Message not found' });
      }
      
      // Check if user owns the message or is admin
      if (message.sender.toString() !== socket.user._id.toString() && 
          socket.user.role !== 'admin') {
        return socket.emit('error', { message: 'Not authorized to delete this message' });
      }
      
      // Remove message
      chat.messages.pull(messageId);
      await chat.save();
      
      // Broadcast message deletion
      io.to(`chat:${chatId}`).emit('message_deleted', {
        chatId,
        messageId
      });
      
    } catch (error) {
      socket.emit('error', { message: 'Error deleting message' });
    }
  });
  
  // Voice call initiation
  socket.on('initiate_voice_call', async (data) => {
    try {
      const { chatId, callType = 'voice' } = data;
      
      const chat = await Chat.findById(chatId);
      
      if (!chat) {
        return socket.emit('error', { message: 'Chat not found' });
      }
      
      // For direct chats only
      if (chat.chatType !== 'direct') {
        return socket.emit('error', { message: 'Voice calls only available for direct chats' });
      }
      
      const otherParticipant = chat.participants.find(
        p => p.user.toString() !== socket.user._id.toString()
      );
      
      if (!otherParticipant) {
        return socket.emit('error', { message: 'Participant not found' });
      }
      
      // Send call request to other participant
      io.to(`user:${otherParticipant.user}`).emit('incoming_call', {
        callId: `call:${Date.now()}`,
        from: {
          id: socket.user._id,
          username: socket.user.username,
          profilePicture: socket.user.profilePicture
        },
        callType,
        chatId
      });
      
    } catch (error) {
      socket.emit('error', { message: 'Error initiating call' });
    }
  });
  
  // Handle disconnect
  socket.on('disconnect', async () => {
    try {
      // Update user online status
      socket.user.isOnline = false;
      socket.user.lastActive = new Date();
      await socket.user.save();
      
      // Notify other users that this user is offline
      socket.broadcast.emit('user_offline', {
        userId: socket.user._id,
        username: socket.user.username,
        lastActive: socket.user.lastActive
      });
      
    } catch (error) {
      console.error('Error handling disconnect:', error);
    }
  });
};

module.exports = chatHandler;