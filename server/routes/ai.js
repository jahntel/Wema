const express = require('express');
const router = express.Router();
const { OpenAI } = require('openai');
const User = require('../models/User');
const Resource = require('../models/Resource');
const NeedForecast = require('../models/NeedForecast');
const auth = require('../middleware/auth');

// Initialize OpenAI (only if API key is provided)
let openai = null;
if (process.env.OPENAI_API_KEY) {
  openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
}

// Chatbot endpoint
router.post('/chat', auth, async (req, res) => {
  try {
    const { message, context } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    // If OpenAI is not configured, provide basic responses
    if (!openai) {
      const basicResponses = {
        'hello': 'Hello! I\'m here to help you navigate the Community Aid Platform. How can I assist you today?',
        'help': 'I can help you with finding resources, connecting with community members, or answering questions about the platform.',
        'resources': 'You can browse available resources by category, location, or search for specific items. Would you like me to help you find something?',
        'donate': 'To donate resources, go to the "Add Resource" section and fill in the details about what you\'d like to share.',
        'default': 'I\'m here to help! You can ask me about finding resources, donating items, or using the platform features.'
      };

      const lowerMessage = message.toLowerCase();
      let response = basicResponses.default;

      for (const [key, value] of Object.entries(basicResponses)) {
        if (lowerMessage.includes(key)) {
          response = value;
          break;
        }
      }

      return res.json({ response, source: 'basic' });
    }

    // Get user context
    const user = await User.findById(req.user.id);
    
    // Build context for the AI
    const systemPrompt = `You are a helpful assistant for the Community Aid Platform, a platform that connects community members to share resources and services. 

User context:
- Name: ${user.name}
- Role: ${user.role}
- Location: ${user.location?.city || 'Not specified'}

Platform features you can help with:
- Finding and requesting resources
- Donating and sharing resources
- Connecting with community members
- Using the chat system
- Participating in community challenges
- Understanding impact tracking
- Accessibility features

Guidelines:
- Be helpful, friendly, and community-focused
- Provide specific guidance about platform features
- Encourage community participation and kindness
- If asked about technical issues, suggest contacting support
- Keep responses concise but informative
- Focus on building stronger communities

Current message context: ${context || 'General conversation'}`;

    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: message }
      ],
      max_tokens: 300,
      temperature: 0.7,
    });

    const response = completion.choices[0].message.content;

    res.json({ response, source: 'openai' });
  } catch (error) {
    console.error('AI chat error:', error);
    
    // Fallback response if AI fails
    const fallbackResponse = "I'm having trouble processing your request right now. Please try again later or contact support if you need immediate assistance.";
    res.json({ response: fallbackResponse, source: 'fallback' });
  }
});

// Need forecasting endpoint
router.post('/forecast', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { location, timeframe = '30d' } = req.body;

    // Get historical data
    const now = new Date();
    const startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000); // 90 days ago

    // Get resource requests and donations in the area
    const resources = await Resource.find({
      ...(location && {
        'location.city': { $regex: location, $options: 'i' }
      }),
      createdAt: { $gte: startDate }
    });

    // Analyze patterns
    const categoryTrends = {};
    const monthlyTrends = {};

    resources.forEach(resource => {
      const category = resource.category;
      const month = resource.createdAt.toISOString().substring(0, 7); // YYYY-MM

      if (!categoryTrends[category]) {
        categoryTrends[category] = 0;
      }
      categoryTrends[category]++;

      if (!monthlyTrends[month]) {
        monthlyTrends[month] = 0;
      }
      monthlyTrends[month]++;
    });

    // Simple forecasting logic (can be enhanced with ML models)
    const forecast = {
      location: location || 'All locations',
      timeframe,
      predictedNeeds: [],
      trends: {
        categories: categoryTrends,
        monthly: monthlyTrends
      },
      recommendations: []
    };

    // Generate predictions based on trends
    const sortedCategories = Object.entries(categoryTrends)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5);

    sortedCategories.forEach(([category, count]) => {
      const trend = count / 3; // Average per month
      const prediction = Math.round(trend * 1.2); // 20% increase prediction

      forecast.predictedNeeds.push({
        category,
        predictedDemand: prediction,
        confidence: 'medium',
        currentTrend: count
      });
    });

    // Generate recommendations
    forecast.recommendations = [
      'Focus donation drives on high-demand categories',
      'Increase community outreach in underserved areas',
      'Prepare for seasonal variations in resource needs',
      'Encourage donors to contribute to predicted high-need categories'
    ];

    // Save forecast
    const needForecast = new NeedForecast({
      location: location || 'global',
      timeframe,
      predictions: forecast.predictedNeeds,
      confidence: 'medium',
      generatedBy: req.user.id,
      generatedAt: new Date()
    });

    await needForecast.save();

    res.json(forecast);
  } catch (error) {
    console.error('Need forecasting error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Resource matching endpoint
router.post('/match', auth, async (req, res) => {
  try {
    const { resourceId, maxResults = 10 } = req.body;

    if (!resourceId) {
      return res.status(400).json({ error: 'Resource ID is required' });
    }

    const resource = await Resource.findById(resourceId);
    if (!resource) {
      return res.status(404).json({ error: 'Resource not found' });
    }

    // Find potential matches based on:
    // 1. Similar category
    // 2. Geographic proximity
    // 3. User preferences
    const matches = await Resource.find({
      _id: { $ne: resourceId },
      available: true,
      category: resource.category,
      location: {
        $near: {
          $geometry: resource.location,
          $maxDistance: 10000 // 10km radius
        }
      }
    })
    .populate('donor', 'name profilePicture')
    .limit(maxResults);

    // Calculate match scores
    const scoredMatches = matches.map(match => {
      let score = 0;
      
      // Category match (base score)
      if (match.category === resource.category) score += 50;
      
      // Condition similarity
      if (match.condition === resource.condition) score += 20;
      
      // Recency bonus
      const daysSincePosted = (new Date() - match.createdAt) / (1000 * 60 * 60 * 24);
      if (daysSincePosted <= 7) score += 15;
      else if (daysSincePosted <= 30) score += 10;
      
      // Interest level
      score += Math.min(match.interestedUsers.length * 5, 15);

      return {
        resource: match,
        matchScore: score,
        reasons: [
          ...(match.category === resource.category ? ['Same category'] : []),
          ...(match.condition === resource.condition ? ['Similar condition'] : []),
          ...(daysSincePosted <= 7 ? ['Recently posted'] : []),
          ...(match.interestedUsers.length > 0 ? ['High interest'] : [])
        ]
      };
    });

    // Sort by match score
    scoredMatches.sort((a, b) => b.matchScore - a.matchScore);

    res.json({
      originalResource: resource,
      matches: scoredMatches,
      totalMatches: scoredMatches.length
    });
  } catch (error) {
    console.error('Resource matching error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Smart recommendations endpoint
router.get('/recommendations', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    const { type = 'resources' } = req.query;

    let recommendations = [];

    if (type === 'resources') {
      // Get user's location and preferences
      const userLocation = user.location;
      
      // Find resources near the user
      const nearbyResources = await Resource.find({
        available: true,
        donor: { $ne: req.user.id },
        ...(userLocation && {
          location: {
            $near: {
              $geometry: userLocation,
              $maxDistance: 15000 // 15km radius
            }
          }
        })
      })
      .populate('donor', 'name profilePicture')
      .limit(20);

      // Score and rank recommendations
      recommendations = nearbyResources.map(resource => {
        let score = 0;
        const reasons = [];

        // Proximity bonus
        if (userLocation) {
          score += 30;
          reasons.push('Near your location');
        }

        // Recency bonus
        const daysSincePosted = (new Date() - resource.createdAt) / (1000 * 60 * 60 * 24);
        if (daysSincePosted <= 3) {
          score += 25;
          reasons.push('Recently posted');
        }

        // Interest level
        if (resource.interestedUsers.length > 0) {
          score += 15;
          reasons.push('Popular item');
        }

        // Category preference (if user has history)
        // This could be enhanced with user interaction history
        score += Math.random() * 10; // Random factor for diversity

        return {
          resource,
          score,
          reasons
        };
      });

      recommendations.sort((a, b) => b.score - a.score);
    }

    res.json({
      type,
      recommendations: recommendations.slice(0, 10),
      generatedAt: new Date()
    });
  } catch (error) {
    console.error('Recommendations error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Content moderation endpoint
router.post('/moderate', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { content, type = 'text' } = req.body;

    if (!content) {
      return res.status(400).json({ error: 'Content is required' });
    }

    // Basic content moderation rules
    const flags = [];
    const lowercaseContent = content.toLowerCase();

    // Check for inappropriate language
    const inappropriateWords = ['spam', 'scam', 'fake', 'fraud'];
    inappropriateWords.forEach(word => {
      if (lowercaseContent.includes(word)) {
        flags.push({
          type: 'inappropriate_language',
          severity: 'medium',
          match: word
        });
      }
    });

    // Check for personal information
    const phoneRegex = /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/;
    const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/;

    if (phoneRegex.test(content)) {
      flags.push({
        type: 'personal_info',
        severity: 'low',
        match: 'phone_number'
      });
    }

    if (emailRegex.test(content)) {
      flags.push({
        type: 'personal_info',
        severity: 'low',
        match: 'email_address'
      });
    }

    // If using OpenAI, get more sophisticated moderation
    let aiModeration = null;
    if (openai && type === 'text') {
      try {
        const moderation = await openai.moderations.create({
          input: content,
        });

        if (moderation.results[0].flagged) {
          aiModeration = {
            flagged: true,
            categories: moderation.results[0].categories,
            category_scores: moderation.results[0].category_scores
          };
        }
      } catch (error) {
        console.error('OpenAI moderation error:', error);
      }
    }

    const result = {
      content,
      flags,
      aiModeration,
      recommendation: flags.length > 0 || aiModeration?.flagged ? 'review' : 'approve',
      timestamp: new Date()
    };

    res.json(result);
  } catch (error) {
    console.error('Content moderation error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get AI service status
router.get('/status', (req, res) => {
  res.json({
    openai: !!openai,
    features: {
      chat: true,
      forecasting: true,
      matching: true,
      recommendations: true,
      moderation: !!openai
    }
  });
});

module.exports = router;