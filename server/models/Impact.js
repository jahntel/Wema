const mongoose = require('mongoose');

const impactSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  impactType: {
    type: String,
    enum: [
      'donation_given', 'donation_received', 'service_provided', 
      'service_received', 'volunteer_hours', 'mystery_drop', 
      'challenge_completed', 'resource_shared', 'mentorship'
    ],
    required: true
  },
  // Related entities
  relatedResource: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Resource'
  },
  relatedChallenge: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Challenge'
  },
  relatedUser: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  // Impact metrics
  quantitativeValue: {
    type: Number,
    default: 0
  },
  unit: {
    type: String,
    enum: ['items', 'hours', 'people', 'kgs', 'books', 'meals', 'sessions'],
    default: 'items'
  },
  monetaryValue: {
    type: Number,
    default: 0
  },
  currency: {
    type: String,
    default: 'KES'
  },
  // Impact description
  description: {
    type: String,
    maxlength: 500
  },
  // Impact category
  category: {
    type: String,
    enum: [
      'food_security', 'education', 'health', 'housing', 'employment',
      'environment', 'community_building', 'skills_development', 'other'
    ],
    required: true
  },
  // Geographic impact
  location: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: [Number],
    address: String
  },
  // Impact verification
  isVerified: {
    type: Boolean,
    default: false
  },
  verifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  verifiedAt: Date,
  // Impact evidence
  evidence: [{
    type: String, // URL to image/document
    description: String
  }],
  // Beneficiary information
  beneficiaries: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    relationship: {
      type: String,
      enum: ['direct', 'indirect', 'community']
    },
    feedback: String,
    rating: {
      type: Number,
      min: 1,
      max: 5
    }
  }],
  // Impact timeline
  startDate: {
    type: Date,
    default: Date.now
  },
  endDate: Date,
  // Impact sustainability
  sustainabilityScore: {
    type: Number,
    min: 1,
    max: 10,
    default: 5
  },
  // Story and testimonials
  story: {
    type: String,
    maxlength: 1000
  },
  testimonials: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    content: String,
    isPublic: {
      type: Boolean,
      default: true
    },
    addedAt: {
      type: Date,
      default: Date.now
    }
  }],
  // Impact tags
  tags: [{
    type: String,
    trim: true
  }],
  // Visibility settings
  isPublic: {
    type: Boolean,
    default: true
  },
  // Impact goals alignment
  sdgGoals: [{
    type: String,
    enum: [
      'no_poverty', 'zero_hunger', 'good_health', 'quality_education',
      'gender_equality', 'clean_water', 'affordable_energy', 'decent_work',
      'industry_innovation', 'reduced_inequalities', 'sustainable_cities',
      'responsible_consumption', 'climate_action', 'life_below_water',
      'life_on_land', 'peace_justice', 'partnerships'
    ]
  }]
}, {
  timestamps: true
});

// Create indexes for efficient queries
impactSchema.index({ user: 1, createdAt: -1 });
impactSchema.index({ impactType: 1, createdAt: -1 });
impactSchema.index({ category: 1, createdAt: -1 });
impactSchema.index({ location: '2dsphere' });
impactSchema.index({ isVerified: 1, isPublic: 1 });

// Static method to calculate user's total impact
impactSchema.statics.calculateUserImpact = async function(userId) {
  const pipeline = [
    { $match: { user: mongoose.Types.ObjectId(userId) } },
    {
      $group: {
        _id: '$impactType',
        totalQuantity: { $sum: '$quantitativeValue' },
        totalValue: { $sum: '$monetaryValue' },
        count: { $sum: 1 }
      }
    }
  ];
  
  return await this.aggregate(pipeline);
};

// Static method to get community impact summary
impactSchema.statics.getCommunityImpact = async function(timeframe = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - timeframe);
  
  const pipeline = [
    { $match: { createdAt: { $gte: startDate }, isPublic: true } },
    {
      $group: {
        _id: '$category',
        totalQuantity: { $sum: '$quantitativeValue' },
        totalValue: { $sum: '$monetaryValue' },
        uniqueUsers: { $addToSet: '$user' },
        count: { $sum: 1 }
      }
    },
    {
      $project: {
        category: '$_id',
        totalQuantity: 1,
        totalValue: 1,
        uniqueUsersCount: { $size: '$uniqueUsers' },
        count: 1,
        _id: 0
      }
    }
  ];
  
  return await this.aggregate(pipeline);
};

// Method to verify impact
impactSchema.methods.verify = function(verifierId) {
  this.isVerified = true;
  this.verifiedBy = verifierId;
  this.verifiedAt = new Date();
  return this.save();
};

// Method to add testimonial
impactSchema.methods.addTestimonial = function(userId, content, isPublic = true) {
  this.testimonials.push({
    user: userId,
    content: content,
    isPublic: isPublic
  });
  return this.save();
};

// Method to calculate impact score
impactSchema.methods.calculateImpactScore = function() {
  let score = 0;
  
  // Base score from quantitative value
  score += Math.min(this.quantitativeValue * 10, 100);
  
  // Bonus for verification
  if (this.isVerified) score += 20;
  
  // Bonus for testimonials
  score += this.testimonials.length * 5;
  
  // Bonus for beneficiaries
  score += this.beneficiaries.length * 10;
  
  // Sustainability factor
  score = score * (this.sustainabilityScore / 10);
  
  return Math.min(score, 1000); // Cap at 1000
};

module.exports = mongoose.model('Impact', impactSchema);