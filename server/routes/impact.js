const express = require('express');
const router = express.Router();
const Impact = require('../models/Impact');
const User = require('../models/User');
const Resource = require('../models/Resource');
const auth = require('../middleware/auth');

// Get user impact statistics
router.get('/user/:userId', auth, async (req, res) => {
  try {
    const { userId } = req.params;
    const { timeframe = '30d' } = req.query;

    // Calculate date range
    const now = new Date();
    let startDate;
    switch (timeframe) {
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '90d':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      case '1y':
        startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    // Get impact records for the user
    const impactRecords = await Impact.find({
      $or: [
        { donor: userId },
        { receiver: userId }
      ],
      timestamp: { $gte: startDate }
    }).populate('resource', 'title category');

    // Calculate statistics
    const stats = {
      totalImpacts: impactRecords.length,
      asDonor: impactRecords.filter(record => record.donor.toString() === userId).length,
      asReceiver: impactRecords.filter(record => record.receiver.toString() === userId).length,
      resourcesShared: 0,
      resourcesReceived: 0,
      categories: {},
      timeline: []
    };

    // Group by category and calculate timeline
    const dailyStats = {};
    
    impactRecords.forEach(record => {
      const category = record.resource?.category || 'other';
      const date = record.timestamp.toISOString().split('T')[0];

      // Category stats
      if (!stats.categories[category]) {
        stats.categories[category] = { donated: 0, received: 0 };
      }

      if (record.donor.toString() === userId) {
        stats.resourcesShared++;
        stats.categories[category].donated++;
      } else {
        stats.resourcesReceived++;
        stats.categories[category].received++;
      }

      // Daily timeline
      if (!dailyStats[date]) {
        dailyStats[date] = { date, donated: 0, received: 0 };
      }

      if (record.donor.toString() === userId) {
        dailyStats[date].donated++;
      } else {
        dailyStats[date].received++;
      }
    });

    stats.timeline = Object.values(dailyStats).sort((a, b) => new Date(a.date) - new Date(b.date));

    res.json(stats);
  } catch (error) {
    console.error('Get user impact error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get community impact statistics
router.get('/community', async (req, res) => {
  try {
    const { timeframe = '30d' } = req.query;

    // Calculate date range
    const now = new Date();
    let startDate;
    switch (timeframe) {
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '90d':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      case '1y':
        startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    // Get all impact records
    const impactRecords = await Impact.find({
      timestamp: { $gte: startDate }
    }).populate('resource', 'title category')
      .populate('donor', 'name')
      .populate('receiver', 'name');

    // Get user counts
    const totalUsers = await User.countDocuments();
    const activeUsers = await User.countDocuments({
      lastActive: { $gte: startDate }
    });

    // Get resource counts
    const totalResources = await Resource.countDocuments();
    const availableResources = await Resource.countDocuments({ available: true });

    // Calculate community statistics
    const stats = {
      totalUsers,
      activeUsers,
      totalResources,
      availableResources,
      totalImpacts: impactRecords.length,
      resourcesShared: impactRecords.length,
      categories: {},
      timeline: [],
      topDonors: [],
      topReceivers: [],
      recentActivity: impactRecords.slice(-10).reverse()
    };

    // Group by category and calculate timeline
    const dailyStats = {};
    const donorStats = {};
    const receiverStats = {};

    impactRecords.forEach(record => {
      const category = record.resource?.category || 'other';
      const date = record.timestamp.toISOString().split('T')[0];
      const donorId = record.donor._id.toString();
      const receiverId = record.receiver._id.toString();

      // Category stats
      if (!stats.categories[category]) {
        stats.categories[category] = 0;
      }
      stats.categories[category]++;

      // Daily timeline
      if (!dailyStats[date]) {
        dailyStats[date] = { date, count: 0 };
      }
      dailyStats[date].count++;

      // Donor stats
      if (!donorStats[donorId]) {
        donorStats[donorId] = {
          user: record.donor,
          count: 0
        };
      }
      donorStats[donorId].count++;

      // Receiver stats
      if (!receiverStats[receiverId]) {
        receiverStats[receiverId] = {
          user: record.receiver,
          count: 0
        };
      }
      receiverStats[receiverId].count++;
    });

    stats.timeline = Object.values(dailyStats).sort((a, b) => new Date(a.date) - new Date(b.date));
    stats.topDonors = Object.values(donorStats)
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
    stats.topReceivers = Object.values(receiverStats)
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    res.json(stats);
  } catch (error) {
    console.error('Get community impact error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Record impact event
router.post('/', auth, async (req, res) => {
  try {
    const { resourceId, receiverId, impactType, description, rating } = req.body;

    if (!resourceId || !receiverId) {
      return res.status(400).json({ error: 'Resource ID and receiver ID are required' });
    }

    const resource = await Resource.findById(resourceId);
    if (!resource) {
      return res.status(404).json({ error: 'Resource not found' });
    }

    const receiver = await User.findById(receiverId);
    if (!receiver) {
      return res.status(404).json({ error: 'Receiver not found' });
    }

    // Check if user is the donor of the resource
    if (resource.donor.toString() !== req.user.id) {
      return res.status(403).json({ error: 'Only the resource donor can record impact' });
    }

    const impact = new Impact({
      resource: resourceId,
      donor: req.user.id,
      receiver: receiverId,
      impactType: impactType || 'resource_shared',
      description,
      rating: rating || 5,
      timestamp: new Date()
    });

    await impact.save();
    await impact.populate(['resource', 'donor', 'receiver']);

    // Update resource availability if needed
    if (impactType === 'resource_shared') {
      resource.available = false;
      await resource.save();
    }

    res.status(201).json(impact);
  } catch (error) {
    console.error('Record impact error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get impact by ID
router.get('/:id', auth, async (req, res) => {
  try {
    const impact = await Impact.findById(req.params.id)
      .populate('resource', 'title category images')
      .populate('donor', 'name profilePicture')
      .populate('receiver', 'name profilePicture');

    if (!impact) {
      return res.status(404).json({ error: 'Impact record not found' });
    }

    // Check if user is involved in this impact
    const userId = req.user.id;
    if (impact.donor._id.toString() !== userId && impact.receiver._id.toString() !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json(impact);
  } catch (error) {
    console.error('Get impact error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update impact record
router.put('/:id', auth, async (req, res) => {
  try {
    const { description, rating, feedback } = req.body;

    const impact = await Impact.findById(req.params.id);
    if (!impact) {
      return res.status(404).json({ error: 'Impact record not found' });
    }

    // Check if user is involved in this impact
    const userId = req.user.id;
    if (impact.donor.toString() !== userId && impact.receiver.toString() !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Update fields
    if (description) impact.description = description;
    if (rating) impact.rating = rating;
    if (feedback) impact.feedback = feedback;

    await impact.save();
    await impact.populate(['resource', 'donor', 'receiver']);

    res.json(impact);
  } catch (error) {
    console.error('Update impact error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get impact leaderboard
router.get('/leaderboard/:type', async (req, res) => {
  try {
    const { type } = req.params; // 'donors' or 'receivers'
    const { timeframe = '30d', limit = 10 } = req.query;

    // Calculate date range
    const now = new Date();
    let startDate;
    switch (timeframe) {
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '90d':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      case '1y':
        startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    const groupField = type === 'donors' ? 'donor' : 'receiver';
    
    const leaderboard = await Impact.aggregate([
      {
        $match: {
          timestamp: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: `$${groupField}`,
          count: { $sum: 1 },
          avgRating: { $avg: '$rating' }
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'user'
        }
      },
      {
        $unwind: '$user'
      },
      {
        $project: {
          _id: 1,
          count: 1,
          avgRating: { $round: ['$avgRating', 1] },
          user: {
            _id: '$user._id',
            name: '$user.name',
            profilePicture: '$user.profilePicture'
          }
        }
      },
      {
        $sort: { count: -1 }
      },
      {
        $limit: parseInt(limit)
      }
    ]);

    res.json(leaderboard);
  } catch (error) {
    console.error('Get leaderboard error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get impact analytics for admin
router.get('/admin/analytics', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { timeframe = '30d' } = req.query;

    // Calculate date range
    const now = new Date();
    let startDate;
    switch (timeframe) {
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '90d':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      case '1y':
        startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    // Get comprehensive analytics
    const [
      totalImpacts,
      impactsByCategory,
      impactsByLocation,
      avgRating,
      growthRate
    ] = await Promise.all([
      Impact.countDocuments({ timestamp: { $gte: startDate } }),
      
      Impact.aggregate([
        { $match: { timestamp: { $gte: startDate } } },
        { $lookup: { from: 'resources', localField: 'resource', foreignField: '_id', as: 'resource' } },
        { $unwind: '$resource' },
        { $group: { _id: '$resource.category', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]),
      
      Impact.aggregate([
        { $match: { timestamp: { $gte: startDate } } },
        { $lookup: { from: 'users', localField: 'donor', foreignField: '_id', as: 'donor' } },
        { $unwind: '$donor' },
        { $group: { _id: '$donor.location.city', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 }
      ]),
      
      Impact.aggregate([
        { $match: { timestamp: { $gte: startDate } } },
        { $group: { _id: null, avgRating: { $avg: '$rating' } } }
      ]),
      
      Impact.aggregate([
        { $match: { timestamp: { $gte: startDate } } },
        { $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } },
          count: { $sum: 1 }
        }},
        { $sort: { _id: 1 } }
      ])
    ]);

    const analytics = {
      totalImpacts,
      impactsByCategory,
      impactsByLocation,
      avgRating: avgRating[0]?.avgRating || 0,
      growthRate
    };

    res.json(analytics);
  } catch (error) {
    console.error('Get admin analytics error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;