const mongoose = require('mongoose');

const challengeSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  description: {
    type: String,
    required: true,
    maxlength: 1000
  },
  challengeType: {
    type: String,
    enum: ['kindness', 'mystery_drop', 'community_service', 'skill_share', 'donation_drive'],
    required: true
  },
  difficulty: {
    type: String,
    enum: ['easy', 'medium', 'hard'],
    default: 'medium'
  },
  // Challenge creator
  creator: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  // Challenge status
  status: {
    type: String,
    enum: ['draft', 'active', 'completed', 'cancelled'],
    default: 'draft'
  },
  // Challenge timeline
  startDate: {
    type: Date,
    required: true
  },
  endDate: {
    type: Date,
    required: true
  },
  // Challenge location
  location: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: [Number],
    address: String
  },
  isLocationSpecific: {
    type: Boolean,
    default: false
  },
  // Challenge requirements
  requirements: [{
    type: String,
    maxlength: 200
  }],
  // Challenge rewards
  rewards: {
    points: {
      type: Number,
      default: 0
    },
    badges: [{
      name: String,
      description: String,
      icon: String
    }],
    description: String
  },
  // Challenge targets
  targetParticipants: {
    type: Number,
    default: 0
  },
  targetImpact: {
    quantity: Number,
    unit: String,
    description: String
  },
  // Challenge participation
  participants: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    joinedAt: {
      type: Date,
      default: Date.now
    },
    progress: {
      type: Number,
      default: 0,
      min: 0,
      max: 100
    },
    isCompleted: {
      type: Boolean,
      default: false
    },
    completedAt: Date,
    submission: {
      description: String,
      evidence: [{
        type: String, // URL to image/document
        description: String
      }],
      submittedAt: Date
    },
    feedback: String,
    rating: {
      type: Number,
      min: 1,
      max: 5
    }
  }],
  // Challenge resources
  resources: [{
    title: String,
    url: String,
    type: {
      type: String,
      enum: ['guide', 'video', 'document', 'template']
    }
  }],
  // Challenge rules
  rules: [{
    type: String,
    maxlength: 300
  }],
  // Challenge categories
  categories: [{
    type: String,
    enum: [
      'food_security', 'education', 'health', 'environment',
      'community_building', 'skills_development', 'youth_engagement',
      'elderly_care', 'disability_support', 'other'
    ]
  }],
  // Challenge tags
  tags: [{
    type: String,
    trim: true
  }],
  // Challenge visibility
  isPublic: {
    type: Boolean,
    default: true
  },
  // Challenge recurrence
  isRecurring: {
    type: Boolean,
    default: false
  },
  recurrencePattern: {
    type: String,
    enum: ['daily', 'weekly', 'monthly', 'yearly']
  },
  // Challenge metrics
  metrics: {
    totalParticipants: {
      type: Number,
      default: 0
    },
    completedParticipants: {
      type: Number,
      default: 0
    },
    totalImpact: {
      type: Number,
      default: 0
    },
    averageRating: {
      type: Number,
      default: 0
    }
  },
  // Challenge chat
  chatChannel: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Chat'
  },
  // Challenge announcements
  announcements: [{
    title: String,
    content: String,
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    createdAt: {
      type: Date,
      default: Date.now
    },
    isUrgent: {
      type: Boolean,
      default: false
    }
  }],
  // Challenge sponsors
  sponsors: [{
    name: String,
    logo: String,
    website: String,
    contribution: String
  }],
  // Challenge FAQs
  faqs: [{
    question: String,
    answer: String,
    addedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  }],
  // Language support
  language: {
    type: String,
    default: 'en'
  },
  translations: [{
    language: String,
    title: String,
    description: String,
    requirements: [String],
    rules: [String]
  }]
}, {
  timestamps: true
});

// Create indexes for efficient queries
challengeSchema.index({ status: 1, startDate: -1 });
challengeSchema.index({ challengeType: 1, isPublic: 1 });
challengeSchema.index({ location: '2dsphere' });
challengeSchema.index({ creator: 1 });
challengeSchema.index({ 'participants.user': 1 });

// Create text index for search
challengeSchema.index({
  title: 'text',
  description: 'text',
  tags: 'text'
});

// Method to join challenge
challengeSchema.methods.addParticipant = function(userId) {
  const existingParticipant = this.participants.find(
    p => p.user.toString() === userId.toString()
  );
  
  if (existingParticipant) {
    throw new Error('User is already participating in this challenge');
  }
  
  this.participants.push({ user: userId });
  this.metrics.totalParticipants = this.participants.length;
  
  return this.save();
};

// Method to update participant progress
challengeSchema.methods.updateProgress = function(userId, progress, submission = null) {
  const participant = this.participants.find(
    p => p.user.toString() === userId.toString()
  );
  
  if (!participant) {
    throw new Error('User is not participating in this challenge');
  }
  
  participant.progress = progress;
  
  if (submission) {
    participant.submission = {
      ...submission,
      submittedAt: new Date()
    };
  }
  
  if (progress >= 100) {
    participant.isCompleted = true;
    participant.completedAt = new Date();
    this.metrics.completedParticipants = this.participants.filter(p => p.isCompleted).length;
  }
  
  return this.save();
};

// Method to add announcement
challengeSchema.methods.addAnnouncement = function(title, content, authorId, isUrgent = false) {
  this.announcements.push({
    title,
    content,
    author: authorId,
    isUrgent
  });
  
  return this.save();
};

// Method to check if user can participate
challengeSchema.methods.canUserParticipate = function(userId) {
  const now = new Date();
  
  // Check if challenge is active
  if (this.status !== 'active') return false;
  
  // Check if challenge period is valid
  if (now < this.startDate || now > this.endDate) return false;
  
  // Check if user is already participating
  const isParticipating = this.participants.some(
    p => p.user.toString() === userId.toString()
  );
  
  return !isParticipating;
};

// Method to calculate completion rate
challengeSchema.methods.getCompletionRate = function() {
  if (this.participants.length === 0) return 0;
  return (this.metrics.completedParticipants / this.participants.length) * 100;
};

// Static method to find active challenges
challengeSchema.statics.findActiveChallenges = function(location = null, radius = 10000) {
  const now = new Date();
  const query = {
    status: 'active',
    startDate: { $lte: now },
    endDate: { $gte: now },
    isPublic: true
  };
  
  if (location) {
    query.location = {
      $near: {
        $geometry: {
          type: 'Point',
          coordinates: location
        },
        $maxDistance: radius
      }
    };
  }
  
  return this.find(query).populate('creator', 'username profilePicture');
};

// Static method to get challenge leaderboard
challengeSchema.statics.getLeaderboard = function(challengeId) {
  return this.findById(challengeId)
    .populate('participants.user', 'username profilePicture')
    .then(challenge => {
      if (!challenge) return null;
      
      const leaderboard = challenge.participants
        .filter(p => p.isCompleted)
        .sort((a, b) => new Date(a.completedAt) - new Date(b.completedAt))
        .map((p, index) => ({
          rank: index + 1,
          user: p.user,
          completedAt: p.completedAt,
          progress: p.progress,
          rating: p.rating
        }));
      
      return leaderboard;
    });
};

module.exports = mongoose.model('Challenge', challengeSchema);