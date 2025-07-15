const User = require('../models/User');
const Resource = require('../models/Resource');
const Challenge = require('../models/Challenge');
const NeedForecast = require('../models/NeedForecast');

const notificationHandler = (socket, io) => {
  
  // Join user to notification room
  socket.join(`notifications:${socket.user._id}`);
  
  // Subscribe to location-based notifications
  socket.on('subscribe_location_alerts', async (data) => {
    try {
      const { coordinates, radius = 10000 } = data;
      
      // Join location-based room
      socket.join(`location:${coordinates[0]}-${coordinates[1]}`);
      
      // Send existing alerts for this location
      const criticalForecasts = await NeedForecast.getCriticalNeedsAlerts(coordinates, radius);
      
      if (criticalForecasts.length > 0) {
        socket.emit('critical_needs_alert', {
          type: 'critical_needs',
          forecasts: criticalForecasts.map(f => ({
            id: f._id,
            location: f.location,
            needs: f.getHighPriorityNeeds(),
            urgency: 'critical'
          }))
        });
      }
      
    } catch (error) {
      socket.emit('error', { message: 'Error subscribing to location alerts' });
    }
  });
  
  // Subscribe to resource category alerts
  socket.on('subscribe_resource_alerts', (data) => {
    const { categories } = data;
    
    categories.forEach(category => {
      socket.join(`resource_alerts:${category}`);
    });
    
    socket.emit('subscribed_resource_alerts', { categories });
  });
  
  // Subscribe to challenge alerts
  socket.on('subscribe_challenge_alerts', (data) => {
    const { challengeTypes } = data;
    
    challengeTypes.forEach(type => {
      socket.join(`challenge_alerts:${type}`);
    });
    
    socket.emit('subscribed_challenge_alerts', { challengeTypes });
  });
  
  // Send emergency alert
  socket.on('send_emergency_alert', async (data) => {
    try {
      const { title, message, location, urgency = 'high', category } = data;
      
      // Only admins and verified users can send emergency alerts
      if (socket.user.role !== 'admin' && !socket.user.isVerified) {
        return socket.emit('error', { message: 'Not authorized to send emergency alerts' });
      }
      
      const alert = {
        id: `alert:${Date.now()}`,
        type: 'emergency',
        title,
        message,
        location,
        urgency,
        category,
        sender: {
          id: socket.user._id,
          username: socket.user.username,
          role: socket.user.role
        },
        timestamp: new Date()
      };
      
      // Broadcast to location-based rooms
      if (location && location.coordinates) {
        const locationRoom = `location:${location.coordinates[0]}-${location.coordinates[1]}`;
        io.to(locationRoom).emit('emergency_alert', alert);
      }
      
      // Broadcast to category-based rooms
      if (category) {
        io.to(`resource_alerts:${category}`).emit('emergency_alert', alert);
      }
      
      // Broadcast to all users if critical
      if (urgency === 'critical') {
        io.emit('critical_emergency_alert', alert);
      }
      
    } catch (error) {
      socket.emit('error', { message: 'Error sending emergency alert' });
    }
  });
  
  // Send resource available notification
  socket.on('notify_resource_available', async (data) => {
    try {
      const { resourceId } = data;
      
      const resource = await Resource.findById(resourceId).populate('owner', 'username');
      
      if (!resource) {
        return socket.emit('error', { message: 'Resource not found' });
      }
      
      // Check if user owns the resource
      if (resource.owner._id.toString() !== socket.user._id.toString()) {
        return socket.emit('error', { message: 'Not authorized' });
      }
      
      const notification = {
        id: `resource:${resourceId}`,
        type: 'resource_available',
        title: `${resource.category} available`,
        message: `${resource.title} is now available`,
        resource: {
          id: resource._id,
          title: resource.title,
          category: resource.category,
          location: resource.location,
          urgency: resource.urgencyLevel
        },
        timestamp: new Date()
      };
      
      // Notify users interested in this category
      io.to(`resource_alerts:${resource.category}`).emit('resource_notification', notification);
      
      // Notify users who showed interest
      for (const interestedUser of resource.interestedUsers) {
        io.to(`notifications:${interestedUser.user}`).emit('resource_notification', {
          ...notification,
          message: `${resource.title} you were interested in is now available`
        });
      }
      
    } catch (error) {
      socket.emit('error', { message: 'Error sending resource notification' });
    }
  });
  
  // Send challenge invitation
  socket.on('send_challenge_invitation', async (data) => {
    try {
      const { challengeId, invitedUsers } = data;
      
      const challenge = await Challenge.findById(challengeId).populate('creator', 'username');
      
      if (!challenge) {
        return socket.emit('error', { message: 'Challenge not found' });
      }
      
      // Check if user is challenge creator
      if (challenge.creator._id.toString() !== socket.user._id.toString()) {
        return socket.emit('error', { message: 'Not authorized' });
      }
      
      const invitation = {
        id: `challenge_invite:${challengeId}`,
        type: 'challenge_invitation',
        title: `Invitation to join challenge`,
        message: `${socket.user.username} invited you to join "${challenge.title}"`,
        challenge: {
          id: challenge._id,
          title: challenge.title,
          description: challenge.description,
          type: challenge.challengeType,
          startDate: challenge.startDate,
          endDate: challenge.endDate,
          rewards: challenge.rewards
        },
        invitedBy: {
          id: socket.user._id,
          username: socket.user.username
        },
        timestamp: new Date()
      };
      
      // Send invitation to each user
      invitedUsers.forEach(userId => {
        io.to(`notifications:${userId}`).emit('challenge_invitation', invitation);
      });
      
    } catch (error) {
      socket.emit('error', { message: 'Error sending challenge invitation' });
    }
  });
  
  // Send mystery drop notification
  socket.on('send_mystery_drop_alert', async (data) => {
    try {
      const { location, hint, radius = 1000 } = data;
      
      const alert = {
        id: `mystery_drop:${Date.now()}`,
        type: 'mystery_drop',
        title: 'Mystery Drop Alert!',
        message: 'A mystery drop has been placed near your location',
        hint,
        location,
        timestamp: new Date()
      };
      
      // Find nearby users
      const nearbyUsers = await User.find({
        location: {
          $near: {
            $geometry: {
              type: 'Point',
              coordinates: location.coordinates
            },
            $maxDistance: radius
          }
        },
        isOnline: true
      });
      
      // Send notification to nearby users
      nearbyUsers.forEach(user => {
        io.to(`notifications:${user._id}`).emit('mystery_drop_alert', alert);
      });
      
    } catch (error) {
      socket.emit('error', { message: 'Error sending mystery drop alert' });
    }
  });
  
  // Send impact milestone notification
  socket.on('celebrate_impact_milestone', async (data) => {
    try {
      const { milestone, impact } = data;
      
      const celebration = {
        id: `milestone:${Date.now()}`,
        type: 'impact_milestone',
        title: 'Impact Milestone Reached!',
        message: `Congratulations! You've reached a new milestone: ${milestone}`,
        impact,
        timestamp: new Date()
      };
      
      // Send to user's personal notifications
      socket.emit('impact_milestone', celebration);
      
      // If significant milestone, share with community
      if (milestone.includes('100') || milestone.includes('500') || milestone.includes('1000')) {
        const communityNotification = {
          ...celebration,
          message: `${socket.user.username} has reached a milestone: ${milestone}`,
          user: {
            id: socket.user._id,
            username: socket.user.username,
            profilePicture: socket.user.profilePicture
          }
        };
        
        // Broadcast to community
        socket.broadcast.emit('community_milestone', communityNotification);
      }
      
    } catch (error) {
      socket.emit('error', { message: 'Error celebrating milestone' });
    }
  });
  
  // Send local hero recognition
  socket.on('nominate_local_hero', async (data) => {
    try {
      const { nominatedUserId, reason } = data;
      
      const nomination = {
        id: `hero_nomination:${Date.now()}`,
        type: 'hero_nomination',
        title: 'Local Hero Nomination!',
        message: `You've been nominated as a local hero!`,
        reason,
        nominatedBy: {
          id: socket.user._id,
          username: socket.user.username
        },
        timestamp: new Date()
      };
      
      // Send to nominated user
      io.to(`notifications:${nominatedUserId}`).emit('hero_nomination', nomination);
      
      // Update user's hero status
      await User.findByIdAndUpdate(nominatedUserId, {
        $push: {
          heroReviews: {
            user: socket.user._id,
            rating: 5,
            comment: reason,
            date: new Date()
          }
        }
      });
      
    } catch (error) {
      socket.emit('error', { message: 'Error nominating local hero' });
    }
  });
  
  // Send donation drive alert
  socket.on('send_donation_drive_alert', async (data) => {
    try {
      const { title, description, targetAmount, category, urgency = 'medium' } = data;
      
      const driveAlert = {
        id: `donation_drive:${Date.now()}`,
        type: 'donation_drive',
        title,
        description,
        targetAmount,
        category,
        urgency,
        organizer: {
          id: socket.user._id,
          username: socket.user.username
        },
        timestamp: new Date()
      };
      
      // Send to category subscribers
      io.to(`resource_alerts:${category}`).emit('donation_drive_alert', driveAlert);
      
      // Send to all donors if urgent
      if (urgency === 'high' || urgency === 'critical') {
        const donors = await User.find({ role: 'donor' });
        donors.forEach(donor => {
          io.to(`notifications:${donor._id}`).emit('urgent_donation_drive', driveAlert);
        });
      }
      
    } catch (error) {
      socket.emit('error', { message: 'Error sending donation drive alert' });
    }
  });
  
  // AI-powered need prediction alert
  socket.on('ai_need_prediction', async (data) => {
    try {
      const { prediction, confidence, location } = data;
      
      // Only admin or AI system can send predictions
      if (socket.user.role !== 'admin') {
        return socket.emit('error', { message: 'Not authorized' });
      }
      
      const predictionAlert = {
        id: `ai_prediction:${Date.now()}`,
        type: 'ai_prediction',
        title: 'AI Need Prediction',
        message: `Our AI predicts increased demand for ${prediction.category}`,
        prediction,
        confidence,
        location,
        timestamp: new Date()
      };
      
      // Send to location-based users
      if (location && location.coordinates) {
        const locationRoom = `location:${location.coordinates[0]}-${location.coordinates[1]}`;
        io.to(locationRoom).emit('ai_prediction_alert', predictionAlert);
      }
      
      // Send to category subscribers
      io.to(`resource_alerts:${prediction.category}`).emit('ai_prediction_alert', predictionAlert);
      
    } catch (error) {
      socket.emit('error', { message: 'Error sending AI prediction' });
    }
  });
  
  // Handle notification acknowledgment
  socket.on('acknowledge_notification', (data) => {
    const { notificationId } = data;
    
    // Log acknowledgment (in production, save to database)
    console.log(`User ${socket.user.username} acknowledged notification ${notificationId}`);
    
    socket.emit('notification_acknowledged', { notificationId });
  });
  
  // Get notification history
  socket.on('get_notification_history', async (data) => {
    try {
      const { page = 1, limit = 20 } = data;
      
      // In production, this would fetch from database
      // For now, returning mock data
      const notifications = {
        notifications: [],
        currentPage: page,
        totalPages: 1,
        totalNotifications: 0
      };
      
      socket.emit('notification_history', notifications);
      
    } catch (error) {
      socket.emit('error', { message: 'Error fetching notification history' });
    }
  });
  
  // Update notification preferences
  socket.on('update_notification_preferences', async (data) => {
    try {
      const { preferences } = data;
      
      // Update user preferences
      await User.findByIdAndUpdate(socket.user._id, {
        notificationPreferences: preferences
      });
      
      socket.emit('notification_preferences_updated', { preferences });
      
    } catch (error) {
      socket.emit('error', { message: 'Error updating notification preferences' });
    }
  });
  
};

module.exports = notificationHandler;