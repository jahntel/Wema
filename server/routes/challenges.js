const express = require('express');
const router = express.Router();
const Challenge = require('../models/Challenge');
const User = require('../models/User');
const auth = require('../middleware/auth');

// Get all active challenges
router.get('/', async (req, res) => {
  try {
    const { category, difficulty, status = 'active' } = req.query;
    
    let query = {};
    
    if (status === 'active') {
      query.status = 'active';
      query.endDate = { $gte: new Date() };
    } else if (status) {
      query.status = status;
    }
    
    if (category) {
      query.category = category;
    }
    
    if (difficulty) {
      query.difficulty = difficulty;
    }

    const challenges = await Challenge.find(query)
      .populate('creator', 'name profilePicture')
      .sort({ createdAt: -1 });

    res.json(challenges);
  } catch (error) {
    console.error('Get challenges error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get challenge by ID
router.get('/:id', async (req, res) => {
  try {
    const challenge = await Challenge.findById(req.params.id)
      .populate('creator', 'name profilePicture')
      .populate('participants.user', 'name profilePicture');

    if (!challenge) {
      return res.status(404).json({ error: 'Challenge not found' });
    }

    res.json(challenge);
  } catch (error) {
    console.error('Get challenge error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Create new challenge (admin only)
router.post('/', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const {
      title,
      description,
      category,
      difficulty,
      points,
      requirements,
      startDate,
      endDate,
      maxParticipants
    } = req.body;

    if (!title || !description || !category) {
      return res.status(400).json({ error: 'Title, description, and category are required' });
    }

    const challenge = new Challenge({
      title,
      description,
      category,
      difficulty: difficulty || 'medium',
      points: points || 100,
      requirements: requirements || {},
      startDate: startDate ? new Date(startDate) : new Date(),
      endDate: endDate ? new Date(endDate) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
      maxParticipants: maxParticipants || null,
      creator: req.user.id,
      status: 'active'
    });

    await challenge.save();
    await challenge.populate('creator', 'name profilePicture');

    res.status(201).json(challenge);
  } catch (error) {
    console.error('Create challenge error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update challenge (admin only)
router.put('/:id', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const challenge = await Challenge.findById(req.params.id);
    if (!challenge) {
      return res.status(404).json({ error: 'Challenge not found' });
    }

    const {
      title,
      description,
      category,
      difficulty,
      points,
      requirements,
      startDate,
      endDate,
      maxParticipants,
      status
    } = req.body;

    // Update fields
    if (title) challenge.title = title;
    if (description) challenge.description = description;
    if (category) challenge.category = category;
    if (difficulty) challenge.difficulty = difficulty;
    if (points) challenge.points = points;
    if (requirements) challenge.requirements = requirements;
    if (startDate) challenge.startDate = new Date(startDate);
    if (endDate) challenge.endDate = new Date(endDate);
    if (maxParticipants !== undefined) challenge.maxParticipants = maxParticipants;
    if (status) challenge.status = status;

    await challenge.save();
    await challenge.populate('creator', 'name profilePicture');

    res.json(challenge);
  } catch (error) {
    console.error('Update challenge error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete challenge (admin only)
router.delete('/:id', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const challenge = await Challenge.findByIdAndDelete(req.params.id);
    if (!challenge) {
      return res.status(404).json({ error: 'Challenge not found' });
    }

    res.json({ message: 'Challenge deleted successfully' });
  } catch (error) {
    console.error('Delete challenge error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Join challenge
router.post('/:id/join', auth, async (req, res) => {
  try {
    const challenge = await Challenge.findById(req.params.id);
    if (!challenge) {
      return res.status(404).json({ error: 'Challenge not found' });
    }

    // Check if challenge is active
    if (challenge.status !== 'active' || challenge.endDate < new Date()) {
      return res.status(400).json({ error: 'Challenge is not active' });
    }

    // Check if user is already participating
    const isParticipating = challenge.participants.some(
      p => p.user.toString() === req.user.id
    );
    if (isParticipating) {
      return res.status(400).json({ error: 'Already participating in this challenge' });
    }

    // Check max participants limit
    if (challenge.maxParticipants && challenge.participants.length >= challenge.maxParticipants) {
      return res.status(400).json({ error: 'Challenge is full' });
    }

    // Add user to participants
    challenge.participants.push({
      user: req.user.id,
      joinedAt: new Date(),
      progress: 0,
      completed: false
    });

    await challenge.save();
    res.json({ message: 'Successfully joined challenge' });
  } catch (error) {
    console.error('Join challenge error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Leave challenge
router.post('/:id/leave', auth, async (req, res) => {
  try {
    const challenge = await Challenge.findById(req.params.id);
    if (!challenge) {
      return res.status(404).json({ error: 'Challenge not found' });
    }

    // Remove user from participants
    challenge.participants = challenge.participants.filter(
      p => p.user.toString() !== req.user.id
    );

    await challenge.save();
    res.json({ message: 'Successfully left challenge' });
  } catch (error) {
    console.error('Leave challenge error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update challenge progress
router.post('/:id/progress', auth, async (req, res) => {
  try {
    const { progress, evidence } = req.body;

    const challenge = await Challenge.findById(req.params.id);
    if (!challenge) {
      return res.status(404).json({ error: 'Challenge not found' });
    }

    // Find user's participation
    const participantIndex = challenge.participants.findIndex(
      p => p.user.toString() === req.user.id
    );

    if (participantIndex === -1) {
      return res.status(400).json({ error: 'Not participating in this challenge' });
    }

    // Update progress
    const participant = challenge.participants[participantIndex];
    participant.progress = Math.max(participant.progress, progress || 0);
    participant.lastUpdate = new Date();

    if (evidence) {
      if (!participant.evidence) participant.evidence = [];
      participant.evidence.push({
        type: evidence.type || 'text',
        content: evidence.content,
        timestamp: new Date()
      });
    }

    // Check if challenge is completed
    if (participant.progress >= 100 && !participant.completed) {
      participant.completed = true;
      participant.completedAt = new Date();

      // Award points to user
      const user = await User.findById(req.user.id);
      if (!user.points) user.points = 0;
      user.points += challenge.points;
      await user.save();
    }

    await challenge.save();
    res.json({ message: 'Progress updated successfully', participant });
  } catch (error) {
    console.error('Update progress error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get user's challenges
router.get('/user/:userId', async (req, res) => {
  try {
    const { status } = req.query;
    const { userId } = req.params;

    let matchStage = { 'participants.user': userId };
    
    if (status === 'completed') {
      matchStage['participants.completed'] = true;
    } else if (status === 'active') {
      matchStage['participants.completed'] = false;
      matchStage.status = 'active';
      matchStage.endDate = { $gte: new Date() };
    }

    const challenges = await Challenge.find(matchStage)
      .populate('creator', 'name profilePicture')
      .sort({ createdAt: -1 });

    // Add user's participation details
    const challengesWithProgress = challenges.map(challenge => {
      const participant = challenge.participants.find(
        p => p.user.toString() === userId
      );
      
      return {
        ...challenge.toObject(),
        userProgress: participant
      };
    });

    res.json(challengesWithProgress);
  } catch (error) {
    console.error('Get user challenges error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get challenge leaderboard
router.get('/:id/leaderboard', async (req, res) => {
  try {
    const challenge = await Challenge.findById(req.params.id)
      .populate('participants.user', 'name profilePicture');

    if (!challenge) {
      return res.status(404).json({ error: 'Challenge not found' });
    }

    // Sort participants by progress and completion
    const leaderboard = challenge.participants
      .sort((a, b) => {
        if (a.completed && !b.completed) return -1;
        if (!a.completed && b.completed) return 1;
        if (a.completed && b.completed) {
          return new Date(a.completedAt) - new Date(b.completedAt);
        }
        return b.progress - a.progress;
      })
      .map((participant, index) => ({
        rank: index + 1,
        user: participant.user,
        progress: participant.progress,
        completed: participant.completed,
        completedAt: participant.completedAt,
        joinedAt: participant.joinedAt
      }));

    res.json(leaderboard);
  } catch (error) {
    console.error('Get leaderboard error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get challenge statistics
router.get('/:id/stats', async (req, res) => {
  try {
    const challenge = await Challenge.findById(req.params.id);
    if (!challenge) {
      return res.status(404).json({ error: 'Challenge not found' });
    }

    const stats = {
      totalParticipants: challenge.participants.length,
      completedParticipants: challenge.participants.filter(p => p.completed).length,
      avgProgress: challenge.participants.length > 0 
        ? challenge.participants.reduce((sum, p) => sum + p.progress, 0) / challenge.participants.length 
        : 0,
      daysRemaining: Math.max(0, Math.ceil((challenge.endDate - new Date()) / (1000 * 60 * 60 * 24))),
      completionRate: challenge.participants.length > 0 
        ? (challenge.participants.filter(p => p.completed).length / challenge.participants.length) * 100 
        : 0
    };

    res.json(stats);
  } catch (error) {
    console.error('Get challenge stats error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get challenge categories
router.get('/meta/categories', async (req, res) => {
  try {
    const categories = await Challenge.distinct('category');
    res.json(categories);
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;