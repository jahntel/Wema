const mongoose = require('mongoose');

const resourceSchema = new mongoose.Schema({
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
  category: {
    type: String,
    required: true,
    enum: [
      'food', 'clothing', 'books', 'electronics', 'furniture', 
      'medical', 'educational', 'tools', 'toys', 'services', 'other'
    ]
  },
  subcategory: {
    type: String,
    trim: true
  },
  images: [{
    url: String,
    publicId: String
  }],
  voiceNote: {
    url: String,
    publicId: String,
    duration: Number // in seconds
  },
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  status: {
    type: String,
    enum: ['available', 'reserved', 'completed', 'cancelled'],
    default: 'available'
  },
  type: {
    type: String,
    enum: ['donation', 'request', 'service', 'mystery_drop'],
    required: true
  },
  // For service type resources
  serviceType: {
    type: String,
    enum: ['tutoring', 'tech_repair', 'cooking', 'cleaning', 'transport', 'other']
  },
  // Location information
  location: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: {
      type: [Number],
      required: true
    },
    address: {
      type: String,
      required: true
    }
  },
  // Drop-off/pickup information
  dropOffPoint: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'DropOffPoint'
  },
  pickupTime: {
    start: Date,
    end: Date
  },
  // Quantity and condition
  quantity: {
    type: Number,
    default: 1,
    min: 1
  },
  condition: {
    type: String,
    enum: ['new', 'like_new', 'good', 'fair', 'poor'],
    default: 'good'
  },
  // Urgency level
  urgencyLevel: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'medium'
  },
  // Mystery drop specific fields
  isMysteryDrop: {
    type: Boolean,
    default: false
  },
  mysteryDropHint: {
    type: String,
    maxlength: 200
  },
  // Matching and reservations
  interestedUsers: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    message: String,
    requestedAt: {
      type: Date,
      default: Date.now
    }
  }],
  reservedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  reservedAt: Date,
  completedAt: Date,
  completedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  // Feedback and rating
  rating: {
    type: Number,
    min: 1,
    max: 5
  },
  feedback: {
    type: String,
    maxlength: 500
  },
  // Tags for better searchability
  tags: [{
    type: String,
    trim: true
  }],
  // Expiration date
  expiresAt: Date,
  // View count
  viewCount: {
    type: Number,
    default: 0
  },
  // Language support
  language: {
    type: String,
    default: 'en'
  },
  translations: [{
    language: String,
    title: String,
    description: String
  }]
}, {
  timestamps: true
});

// Create geospatial index for location-based queries
resourceSchema.index({ location: '2dsphere' });

// Create text index for search functionality
resourceSchema.index({
  title: 'text',
  description: 'text',
  tags: 'text'
});

// Create compound indexes for common queries
resourceSchema.index({ category: 1, status: 1, createdAt: -1 });
resourceSchema.index({ owner: 1, status: 1 });
resourceSchema.index({ type: 1, status: 1, urgencyLevel: 1 });

// Middleware to auto-expire resources
resourceSchema.pre('save', function(next) {
  if (!this.expiresAt) {
    // Default expiration: 30 days for donations, 7 days for requests
    const daysToExpire = this.type === 'donation' ? 30 : 7;
    this.expiresAt = new Date(Date.now() + daysToExpire * 24 * 60 * 60 * 1000);
  }
  next();
});

// Method to check if resource is expired
resourceSchema.methods.isExpired = function() {
  return this.expiresAt && this.expiresAt < new Date();
};

// Method to increment view count
resourceSchema.methods.incrementViews = function() {
  this.viewCount += 1;
  return this.save();
};

// Static method to find nearby resources
resourceSchema.statics.findNearby = function(coordinates, maxDistance = 10000) {
  return this.find({
    location: {
      $near: {
        $geometry: {
          type: 'Point',
          coordinates: coordinates
        },
        $maxDistance: maxDistance
      }
    },
    status: 'available'
  });
};

module.exports = mongoose.model('Resource', resourceSchema);