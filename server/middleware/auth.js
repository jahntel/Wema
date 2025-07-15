const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Middleware to verify JWT token
const authenticate = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'Access denied. No token provided.' });
    }
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    const user = await User.findById(decoded.userId).select('-password');
    
    if (!user) {
      return res.status(401).json({ error: 'Invalid token. User not found.' });
    }
    
    // Update last active timestamp
    user.updateLastActive();
    
    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token.' });
  }
};

// Middleware to check if user has required role
const authorize = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required.' });
    }
    
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ 
        error: 'Access denied. Insufficient permissions.' 
      });
    }
    
    next();
  };
};

// Middleware to check if user is verified
const requireVerification = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required.' });
  }
  
  if (!req.user.isVerified) {
    return res.status(403).json({ 
      error: 'Account verification required.' 
    });
  }
  
  next();
};

// Middleware to check if user owns the resource
const checkResourceOwnership = (Model, paramName = 'id') => {
  return async (req, res, next) => {
    try {
      const resource = await Model.findById(req.params[paramName]);
      
      if (!resource) {
        return res.status(404).json({ error: 'Resource not found.' });
      }
      
      if (resource.owner && resource.owner.toString() !== req.user._id.toString()) {
        return res.status(403).json({ 
          error: 'Access denied. You do not own this resource.' 
        });
      }
      
      req.resource = resource;
      next();
    } catch (error) {
      res.status(500).json({ error: 'Server error.' });
    }
  };
};

// Middleware for rate limiting per user
const userRateLimit = (maxRequests = 100, windowMs = 15 * 60 * 1000) => {
  const userRequests = new Map();
  
  return (req, res, next) => {
    if (!req.user) {
      return next();
    }
    
    const userId = req.user._id.toString();
    const now = Date.now();
    
    if (!userRequests.has(userId)) {
      userRequests.set(userId, { count: 1, resetTime: now + windowMs });
      return next();
    }
    
    const userLimit = userRequests.get(userId);
    
    if (now > userLimit.resetTime) {
      userLimit.count = 1;
      userLimit.resetTime = now + windowMs;
      return next();
    }
    
    if (userLimit.count >= maxRequests) {
      return res.status(429).json({
        error: 'Too many requests. Please try again later.',
        retryAfter: Math.ceil((userLimit.resetTime - now) / 1000)
      });
    }
    
    userLimit.count++;
    next();
  };
};

// Middleware to validate location data
const validateLocation = (req, res, next) => {
  const { coordinates, address } = req.body.location || {};
  
  if (!coordinates || !Array.isArray(coordinates) || coordinates.length !== 2) {
    return res.status(400).json({
      error: 'Invalid location coordinates. Must be [longitude, latitude].'
    });
  }
  
  const [longitude, latitude] = coordinates;
  
  if (typeof longitude !== 'number' || typeof latitude !== 'number') {
    return res.status(400).json({
      error: 'Coordinates must be numbers.'
    });
  }
  
  if (longitude < -180 || longitude > 180 || latitude < -90 || latitude > 90) {
    return res.status(400).json({
      error: 'Invalid coordinate values.'
    });
  }
  
  if (!address || typeof address !== 'string' || address.trim().length === 0) {
    return res.status(400).json({
      error: 'Address is required.'
    });
  }
  
  next();
};

// Middleware to log user activity
const logUserActivity = (action) => {
  return (req, res, next) => {
    if (req.user) {
      console.log(`User ${req.user.username} performed action: ${action} at ${new Date().toISOString()}`);
    }
    next();
  };
};

// Middleware to handle file upload validation
const validateFileUpload = (fileTypes = [], maxSize = 10 * 1024 * 1024) => {
  return (req, res, next) => {
    if (!req.files || req.files.length === 0) {
      return next();
    }
    
    for (const file of req.files) {
      // Check file type
      if (fileTypes.length > 0 && !fileTypes.includes(file.mimetype)) {
        return res.status(400).json({
          error: `Invalid file type. Allowed types: ${fileTypes.join(', ')}`
        });
      }
      
      // Check file size
      if (file.size > maxSize) {
        return res.status(400).json({
          error: `File too large. Maximum size: ${maxSize / (1024 * 1024)}MB`
        });
      }
    }
    
    next();
  };
};

// Middleware to check accessibility requirements
const checkAccessibility = (req, res, next) => {
  const { accessibilityNeeds } = req.user;
  
  if (accessibilityNeeds.visualImpairment && req.body.content && !req.body.altText) {
    return res.status(400).json({
      error: 'Alt text is required for users with visual impairments.'
    });
  }
  
  if (accessibilityNeeds.hearingImpairment && req.body.voiceNote && !req.body.transcript) {
    return res.status(400).json({
      error: 'Transcript is required for users with hearing impairments.'
    });
  }
  
  next();
};

// Middleware to handle language preferences
const handleLanguagePreference = (req, res, next) => {
  const userLanguage = req.user?.preferredLanguage || 'en';
  const acceptLanguage = req.headers['accept-language'];
  
  // Set language preference for responses
  req.language = userLanguage;
  
  // Add language context to request
  req.languageContext = {
    userPreferred: userLanguage,
    browserPreferred: acceptLanguage,
    supported: ['en', 'sw', 'fr', 'ar'] // Add supported languages
  };
  
  next();
};

module.exports = {
  authenticate,
  authorize,
  requireVerification,
  checkResourceOwnership,
  userRateLimit,
  validateLocation,
  logUserActivity,
  validateFileUpload,
  checkAccessibility,
  handleLanguagePreference
};