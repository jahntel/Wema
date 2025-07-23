const express = require('express');
const router = express.Router();
const Resource = require('../models/Resource');
const User = require('../models/User');
const auth = require('../middleware/auth');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Get all resources with filters
router.get('/', async (req, res) => {
  try {
    const {
      category,
      location,
      radius = 10,
      available = 'true',
      search,
      page = 1,
      limit = 20
    } = req.query;

    let query = {};

    // Filter by availability
    if (available === 'true') {
      query.available = true;
    }

    // Filter by category
    if (category) {
      query.category = category;
    }

    // Search in title and description
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    // Location-based filtering
    if (location) {
      const [lng, lat] = location.split(',').map(Number);
      const radiusInRadians = radius / 6371; // Earth's radius in km

      query.location = {
        $geoWithin: {
          $centerSphere: [[lng, lat], radiusInRadians]
        }
      };
    }

    const skip = (page - 1) * limit;
    const resources = await Resource.find(query)
      .populate('donor', 'name profilePicture')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Resource.countDocuments(query);

    res.json({
      resources,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / limit),
        total
      }
    });
  } catch (error) {
    console.error('Get resources error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get resource by ID
router.get('/:id', async (req, res) => {
  try {
    const resource = await Resource.findById(req.params.id)
      .populate('donor', 'name profilePicture phone email')
      .populate('interestedUsers', 'name profilePicture');

    if (!resource) {
      return res.status(404).json({ error: 'Resource not found' });
    }

    res.json(resource);
  } catch (error) {
    console.error('Get resource error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Create new resource
router.post('/', auth, upload.array('images', 5), async (req, res) => {
  try {
    const {
      title,
      description,
      category,
      quantity,
      condition,
      location,
      dropOffPoints,
      voiceNote
    } = req.body;

    const donor = await User.findById(req.user.id);
    if (!donor) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Upload images to Cloudinary
    const imageUrls = [];
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        try {
          const result = await new Promise((resolve, reject) => {
            cloudinary.uploader.upload_stream(
              { resource_type: 'image', folder: 'community-aid/resources' },
              (error, result) => {
                if (error) reject(error);
                else resolve(result);
              }
            ).end(file.buffer);
          });
          imageUrls.push(result.secure_url);
        } catch (uploadError) {
          console.error('Image upload error:', uploadError);
        }
      }
    }

    const resource = new Resource({
      title,
      description,
      category,
      quantity: parseInt(quantity) || 1,
      condition,
      location: location ? JSON.parse(location) : donor.location,
      dropOffPoints: dropOffPoints ? JSON.parse(dropOffPoints) : [],
      images: imageUrls,
      voiceNote,
      donor: req.user.id
    });

    await resource.save();
    await resource.populate('donor', 'name profilePicture');

    res.status(201).json(resource);
  } catch (error) {
    console.error('Create resource error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update resource
router.put('/:id', auth, upload.array('images', 5), async (req, res) => {
  try {
    const resource = await Resource.findById(req.params.id);
    if (!resource) {
      return res.status(404).json({ error: 'Resource not found' });
    }

    // Check if user owns the resource or is admin
    const user = await User.findById(req.user.id);
    if (resource.donor.toString() !== req.user.id && user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const {
      title,
      description,
      category,
      quantity,
      condition,
      location,
      dropOffPoints,
      available,
      voiceNote
    } = req.body;

    // Upload new images if provided
    const newImageUrls = [];
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        try {
          const result = await new Promise((resolve, reject) => {
            cloudinary.uploader.upload_stream(
              { resource_type: 'image', folder: 'community-aid/resources' },
              (error, result) => {
                if (error) reject(error);
                else resolve(result);
              }
            ).end(file.buffer);
          });
          newImageUrls.push(result.secure_url);
        } catch (uploadError) {
          console.error('Image upload error:', uploadError);
        }
      }
    }

    // Update fields
    if (title) resource.title = title;
    if (description) resource.description = description;
    if (category) resource.category = category;
    if (quantity) resource.quantity = parseInt(quantity);
    if (condition) resource.condition = condition;
    if (location) resource.location = JSON.parse(location);
    if (dropOffPoints) resource.dropOffPoints = JSON.parse(dropOffPoints);
    if (available !== undefined) resource.available = available === 'true';
    if (voiceNote) resource.voiceNote = voiceNote;
    if (newImageUrls.length > 0) {
      resource.images = [...resource.images, ...newImageUrls];
    }

    await resource.save();
    await resource.populate('donor', 'name profilePicture');

    res.json(resource);
  } catch (error) {
    console.error('Update resource error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete resource
router.delete('/:id', auth, async (req, res) => {
  try {
    const resource = await Resource.findById(req.params.id);
    if (!resource) {
      return res.status(404).json({ error: 'Resource not found' });
    }

    // Check if user owns the resource or is admin
    const user = await User.findById(req.user.id);
    if (resource.donor.toString() !== req.user.id && user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    await Resource.findByIdAndDelete(req.params.id);
    res.json({ message: 'Resource deleted successfully' });
  } catch (error) {
    console.error('Delete resource error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Express interest in resource
router.post('/:id/interest', auth, async (req, res) => {
  try {
    const resource = await Resource.findById(req.params.id);
    if (!resource) {
      return res.status(404).json({ error: 'Resource not found' });
    }

    if (!resource.available) {
      return res.status(400).json({ error: 'Resource is no longer available' });
    }

    if (resource.donor.toString() === req.user.id) {
      return res.status(400).json({ error: 'Cannot express interest in your own resource' });
    }

    if (resource.interestedUsers.includes(req.user.id)) {
      return res.status(400).json({ error: 'Already expressed interest' });
    }

    resource.interestedUsers.push(req.user.id);
    await resource.save();

    res.json({ message: 'Interest expressed successfully' });
  } catch (error) {
    console.error('Express interest error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Remove interest in resource
router.delete('/:id/interest', auth, async (req, res) => {
  try {
    const resource = await Resource.findById(req.params.id);
    if (!resource) {
      return res.status(404).json({ error: 'Resource not found' });
    }

    resource.interestedUsers = resource.interestedUsers.filter(
      userId => userId.toString() !== req.user.id
    );
    await resource.save();

    res.json({ message: 'Interest removed successfully' });
  } catch (error) {
    console.error('Remove interest error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get user's resources
router.get('/user/:userId', async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (page - 1) * limit;

    const resources = await Resource.find({ donor: req.params.userId })
      .populate('donor', 'name profilePicture')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Resource.countDocuments({ donor: req.params.userId });

    res.json({
      resources,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / limit),
        total
      }
    });
  } catch (error) {
    console.error('Get user resources error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;