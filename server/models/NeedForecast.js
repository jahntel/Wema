const mongoose = require('mongoose');

const needForecastSchema = new mongoose.Schema({
  // Geographic area
  location: {
    type: {
      type: String,
      enum: ['Point', 'Polygon'],
      default: 'Point'
    },
    coordinates: {
      type: [Number],
      required: true
    },
    address: String,
    areaName: String
  },
  // Forecast period
  forecastPeriod: {
    start: {
      type: Date,
      required: true
    },
    end: {
      type: Date,
      required: true
    },
    type: {
      type: String,
      enum: ['daily', 'weekly', 'monthly', 'seasonal'],
      default: 'weekly'
    }
  },
  // Predicted needs
  predictedNeeds: [{
    category: {
      type: String,
      enum: [
        'food', 'clothing', 'books', 'electronics', 'furniture',
        'medical', 'educational', 'tools', 'toys', 'services', 'other'
      ],
      required: true
    },
    subcategory: String,
    demand: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical'],
      required: true
    },
    estimatedQuantity: Number,
    unit: String,
    confidence: {
      type: Number,
      min: 0,
      max: 1
    },
    reasons: [{
      type: String,
      enum: [
        'historical_data', 'seasonal_pattern', 'economic_indicator',
        'weather_pattern', 'social_event', 'emergency_situation',
        'demographic_change', 'supply_shortage'
      ]
    }],
    urgency: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical'],
      default: 'medium'
    }
  }],
  // Data sources used for prediction
  dataSources: [{
    type: {
      type: String,
      enum: [
        'historical_requests', 'donation_patterns', 'weather_data',
        'economic_indicators', 'social_media', 'government_data',
        'ngo_reports', 'user_surveys'
      ]
    },
    weight: {
      type: Number,
      min: 0,
      max: 1
    },
    lastUpdated: Date
  }],
  // AI model information
  modelInfo: {
    modelVersion: String,
    algorithm: String,
    trainingData: {
      startDate: Date,
      endDate: Date,
      sampleSize: Number
    },
    accuracy: {
      type: Number,
      min: 0,
      max: 1
    },
    generatedAt: {
      type: Date,
      default: Date.now
    }
  },
  // Validation and feedback
  validation: {
    isValidated: {
      type: Boolean,
      default: false
    },
    validatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    validatedAt: Date,
    accuracy: {
      type: Number,
      min: 0,
      max: 1
    },
    feedback: String
  },
  // Actual outcomes (for model improvement)
  actualOutcomes: [{
    category: String,
    actualDemand: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical']
    },
    actualQuantity: Number,
    variance: Number, // difference between predicted and actual
    notes: String
  }],
  // Recommendations
  recommendations: [{
    type: {
      type: String,
      enum: ['resource_alert', 'donation_drive', 'volunteer_recruitment', 'partnership'],
      required: true
    },
    title: String,
    description: String,
    priority: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical'],
      default: 'medium'
    },
    targetAudience: [{
      type: String,
      enum: ['donors', 'volunteers', 'organizations', 'government', 'general']
    }],
    actionItems: [String],
    timeline: String,
    estimatedImpact: String
  }],
  // Alert settings
  alertSettings: {
    criticalNeedThreshold: {
      type: Number,
      default: 0.8
    },
    highNeedThreshold: {
      type: Number,
      default: 0.6
    },
    autoAlertEnabled: {
      type: Boolean,
      default: true
    },
    notificationChannels: [{
      type: String,
      enum: ['email', 'sms', 'push', 'dashboard']
    }]
  },
  // Seasonal patterns
  seasonalPatterns: [{
    season: {
      type: String,
      enum: ['dry_season', 'rainy_season', 'planting_season', 'harvest_season']
    },
    expectedIncrease: [{
      category: String,
      percentage: Number
    }],
    expectedDecrease: [{
      category: String,
      percentage: Number
    }]
  }],
  // External factors
  externalFactors: [{
    factor: {
      type: String,
      enum: [
        'weather_event', 'economic_crisis', 'political_event',
        'pandemic', 'school_calendar', 'religious_event',
        'market_fluctuation', 'infrastructure_change'
      ]
    },
    impact: {
      type: String,
      enum: ['positive', 'negative', 'neutral']
    },
    magnitude: {
      type: String,
      enum: ['low', 'medium', 'high']
    },
    affectedCategories: [String],
    description: String
  }],
  // Community insights
  communityInsights: [{
    insight: String,
    source: {
      type: String,
      enum: ['survey', 'interview', 'observation', 'social_media', 'forum']
    },
    reliability: {
      type: Number,
      min: 0,
      max: 1
    },
    contributedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    verifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  }],
  // Status and visibility
  status: {
    type: String,
    enum: ['active', 'expired', 'archived'],
    default: 'active'
  },
  isPublic: {
    type: Boolean,
    default: true
  },
  // Tags
  tags: [{
    type: String,
    trim: true
  }]
}, {
  timestamps: true
});

// Create geospatial index for location-based queries
needForecastSchema.index({ location: '2dsphere' });

// Create indexes for common queries
needForecastSchema.index({ status: 1, 'forecastPeriod.start': -1 });
needForecastSchema.index({ 'predictedNeeds.category': 1, 'predictedNeeds.demand': 1 });
needForecastSchema.index({ 'modelInfo.generatedAt': -1 });

// Method to check if forecast is current
needForecastSchema.methods.isCurrent = function() {
  const now = new Date();
  return now >= this.forecastPeriod.start && now <= this.forecastPeriod.end;
};

// Method to get high priority needs
needForecastSchema.methods.getHighPriorityNeeds = function() {
  return this.predictedNeeds.filter(need => 
    need.demand === 'high' || need.demand === 'critical'
  );
};

// Method to add actual outcome
needForecastSchema.methods.addActualOutcome = function(category, actualDemand, actualQuantity, notes) {
  const predictedNeed = this.predictedNeeds.find(need => need.category === category);
  
  let variance = 0;
  if (predictedNeed) {
    const demandScale = { low: 1, medium: 2, high: 3, critical: 4 };
    const predicted = demandScale[predictedNeed.demand];
    const actual = demandScale[actualDemand];
    variance = Math.abs(predicted - actual) / 4; // Normalize to 0-1 scale
  }
  
  this.actualOutcomes.push({
    category,
    actualDemand,
    actualQuantity,
    variance,
    notes
  });
  
  return this.save();
};

// Method to calculate forecast accuracy
needForecastSchema.methods.calculateAccuracy = function() {
  if (this.actualOutcomes.length === 0) return null;
  
  const totalVariance = this.actualOutcomes.reduce((sum, outcome) => 
    sum + outcome.variance, 0
  );
  
  const averageVariance = totalVariance / this.actualOutcomes.length;
  return 1 - averageVariance; // Higher accuracy = lower variance
};

// Static method to find current forecasts for location
needForecastSchema.statics.findCurrentForLocation = function(coordinates, radius = 10000) {
  const now = new Date();
  
  return this.find({
    location: {
      $near: {
        $geometry: {
          type: 'Point',
          coordinates: coordinates
        },
        $maxDistance: radius
      }
    },
    'forecastPeriod.start': { $lte: now },
    'forecastPeriod.end': { $gte: now },
    status: 'active'
  });
};

// Static method to get critical needs alerts
needForecastSchema.statics.getCriticalNeedsAlerts = function(location = null, radius = 10000) {
  const query = {
    'predictedNeeds.demand': 'critical',
    status: 'active',
    'forecastPeriod.end': { $gte: new Date() }
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
  
  return this.find(query);
};

// Method to generate recommendations
needForecastSchema.methods.generateRecommendations = function() {
  const recommendations = [];
  
  this.predictedNeeds.forEach(need => {
    if (need.demand === 'critical' || need.demand === 'high') {
      recommendations.push({
        type: 'resource_alert',
        title: `High demand predicted for ${need.category}`,
        description: `Based on our analysis, there will be ${need.demand} demand for ${need.category} in the forecast period.`,
        priority: need.demand === 'critical' ? 'critical' : 'high',
        targetAudience: ['donors', 'organizations'],
        actionItems: [
          `Mobilize ${need.category} donations`,
          'Alert local organizations',
          'Prepare distribution channels'
        ],
        timeline: `${this.forecastPeriod.start.toDateString()} - ${this.forecastPeriod.end.toDateString()}`,
        estimatedImpact: `Could help ${need.estimatedQuantity || 'many'} people`
      });
    }
  });
  
  this.recommendations = recommendations;
  return this.save();
};

module.exports = mongoose.model('NeedForecast', needForecastSchema);