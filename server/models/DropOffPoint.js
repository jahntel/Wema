const mongoose = require('mongoose');

const dropOffPointSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  description: {
    type: String,
    maxlength: 500
  },
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
  // Point type
  pointType: {
    type: String,
    enum: ['community_center', 'school', 'church', 'mosque', 'library', 'clinic', 'market', 'other'],
    required: true
  },
  // Operating hours
  operatingHours: {
    monday: {
      open: String,
      close: String,
      isClosed: { type: Boolean, default: false }
    },
    tuesday: {
      open: String,
      close: String,
      isClosed: { type: Boolean, default: false }
    },
    wednesday: {
      open: String,
      close: String,
      isClosed: { type: Boolean, default: false }
    },
    thursday: {
      open: String,
      close: String,
      isClosed: { type: Boolean, default: false }
    },
    friday: {
      open: String,
      close: String,
      isClosed: { type: Boolean, default: false }
    },
    saturday: {
      open: String,
      close: String,
      isClosed: { type: Boolean, default: false }
    },
    sunday: {
      open: String,
      close: String,
      isClosed: { type: Boolean, default: false }
    }
  },
  // Contact information
  contactInfo: {
    phone: String,
    email: String,
    whatsapp: String
  },
  // Point manager/coordinator
  manager: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  // Accepted resource categories
  acceptedCategories: [{
    type: String,
    enum: [
      'food', 'clothing', 'books', 'electronics', 'furniture',
      'medical', 'educational', 'tools', 'toys', 'other'
    ]
  }],
  // Capacity and storage
  capacity: {
    maxItems: {
      type: Number,
      default: 100
    },
    currentItems: {
      type: Number,
      default: 0
    },
    storageTypes: [{
      type: String,
      enum: ['dry_goods', 'refrigerated', 'frozen', 'clothing', 'electronics', 'furniture']
    }]
  },
  // Accessibility features
  accessibility: {
    wheelchairAccessible: {
      type: Boolean,
      default: false
    },
    hasParking: {
      type: Boolean,
      default: false
    },
    hasPublicTransport: {
      type: Boolean,
      default: false
    },
    signLanguageSupport: {
      type: Boolean,
      default: false
    },
    brailleSupport: {
      type: Boolean,
      default: false
    }
  },
  // Security features
  security: {
    isCCTVMonitored: {
      type: Boolean,
      default: false
    },
    hasSecurityGuard: {
      type: Boolean,
      default: false
    },
    isGated: {
      type: Boolean,
      default: false
    },
    lightingAdequate: {
      type: Boolean,
      default: true
    }
  },
  // Point status
  isActive: {
    type: Boolean,
    default: true
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  verifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  verifiedAt: Date,
  // Images
  images: [{
    url: String,
    publicId: String,
    caption: String
  }],
  // Reviews and ratings
  reviews: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    rating: {
      type: Number,
      min: 1,
      max: 5
    },
    comment: String,
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  averageRating: {
    type: Number,
    default: 0,
    min: 0,
    max: 5
  },
  // Usage statistics
  stats: {
    totalDropOffs: {
      type: Number,
      default: 0
    },
    totalPickups: {
      type: Number,
      default: 0
    },
    totalUsers: {
      type: Number,
      default: 0
    },
    lastActivity: Date
  },
  // Special instructions
  specialInstructions: {
    type: String,
    maxlength: 500
  },
  // Emergency contact
  emergencyContact: {
    name: String,
    phone: String,
    relationship: String
  },
  // Facilities available
  facilities: [{
    type: String,
    enum: [
      'wifi', 'restrooms', 'waiting_area', 'charging_station',
      'first_aid', 'water_fountain', 'food_court', 'atm'
    ]
  }],
  // Languages supported
  supportedLanguages: [{
    type: String,
    default: ['en', 'sw'] // English and Swahili
  }],
  // Notification settings
  notificationSettings: {
    emailAlerts: {
      type: Boolean,
      default: true
    },
    smsAlerts: {
      type: Boolean,
      default: true
    },
    capacityWarnings: {
      type: Boolean,
      default: true
    },
    emergencyAlerts: {
      type: Boolean,
      default: true
    }
  },
  // Volunteer information
  volunteers: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    role: {
      type: String,
      enum: ['coordinator', 'helper', 'driver', 'translator'],
      default: 'helper'
    },
    schedule: [{
      day: String,
      startTime: String,
      endTime: String
    }],
    isActive: {
      type: Boolean,
      default: true
    }
  }]
}, {
  timestamps: true
});

// Create geospatial index for location-based queries
dropOffPointSchema.index({ location: '2dsphere' });

// Create indexes for common queries
dropOffPointSchema.index({ pointType: 1, isActive: 1 });
dropOffPointSchema.index({ acceptedCategories: 1 });
dropOffPointSchema.index({ isVerified: 1, isActive: 1 });
dropOffPointSchema.index({ manager: 1 });

// Method to check if point is open at a specific time
dropOffPointSchema.methods.isOpenAt = function(date = new Date()) {
  const dayName = date.toLocaleDateString('en-US', { weekday: 'lowercase' });
  const daySchedule = this.operatingHours[dayName];
  
  if (!daySchedule || daySchedule.isClosed) return false;
  
  const currentTime = date.toTimeString().slice(0, 5); // HH:MM format
  return currentTime >= daySchedule.open && currentTime <= daySchedule.close;
};

// Method to calculate distance from a point
dropOffPointSchema.methods.getDistanceFrom = function(coordinates) {
  const [pointLng, pointLat] = this.location.coordinates;
  const [lng, lat] = coordinates;
  
  const R = 6371; // Earth's radius in km
  const dLat = (lat - pointLat) * Math.PI / 180;
  const dLng = (lng - pointLng) * Math.PI / 180;
  
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(pointLat * Math.PI / 180) * Math.cos(lat * Math.PI / 180) *
            Math.sin(dLng/2) * Math.sin(dLng/2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c; // Distance in km
};

// Method to add review
dropOffPointSchema.methods.addReview = function(userId, rating, comment) {
  this.reviews.push({
    user: userId,
    rating,
    comment
  });
  
  // Recalculate average rating
  const totalRating = this.reviews.reduce((sum, review) => sum + review.rating, 0);
  this.averageRating = totalRating / this.reviews.length;
  
  return this.save();
};

// Method to update capacity
dropOffPointSchema.methods.updateCapacity = function(change) {
  this.capacity.currentItems += change;
  this.capacity.currentItems = Math.max(0, this.capacity.currentItems);
  
  // Update last activity
  this.stats.lastActivity = new Date();
  
  return this.save();
};

// Method to check if point accepts a category
dropOffPointSchema.methods.acceptsCategory = function(category) {
  return this.acceptedCategories.includes(category);
};

// Method to get capacity status
dropOffPointSchema.methods.getCapacityStatus = function() {
  const percentage = (this.capacity.currentItems / this.capacity.maxItems) * 100;
  
  if (percentage >= 90) return 'full';
  if (percentage >= 70) return 'high';
  if (percentage >= 40) return 'medium';
  return 'low';
};

// Static method to find nearby drop-off points
dropOffPointSchema.statics.findNearby = function(coordinates, maxDistance = 10000, category = null) {
  const query = {
    location: {
      $near: {
        $geometry: {
          type: 'Point',
          coordinates: coordinates
        },
        $maxDistance: maxDistance
      }
    },
    isActive: true
  };
  
  if (category) {
    query.acceptedCategories = category;
  }
  
  return this.find(query).populate('manager', 'username phone');
};

// Static method to find points by type
dropOffPointSchema.statics.findByType = function(pointType, location = null, radius = 10000) {
  const query = {
    pointType,
    isActive: true
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
  
  return this.find(query).populate('manager', 'username phone');
};

// Virtual for capacity percentage
dropOffPointSchema.virtual('capacityPercentage').get(function() {
  return (this.capacity.currentItems / this.capacity.maxItems) * 100;
});

module.exports = mongoose.model('DropOffPoint', dropOffPointSchema);