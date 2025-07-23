const express = require('express');
const router = express.Router();
const DropOffPoint = require('../models/DropOffPoint');
const Resource = require('../models/Resource');
const User = require('../models/User');
const auth = require('../middleware/auth');

// Get all drop-off points
router.get('/drop-off-points', async (req, res) => {
  try {
    const { 
      lat, 
      lng, 
      radius = 10, 
      category, 
      active = 'true',
      limit = 50 
    } = req.query;

    let query = {};

    // Filter by active status
    if (active === 'true') {
      query.active = true;
    }

    // Filter by category
    if (category) {
      query.categories = { $in: [category] };
    }

    let dropOffPoints;

    // Location-based search
    if (lat && lng) {
      const radiusInMeters = parseFloat(radius) * 1000; // Convert km to meters
      
      dropOffPoints = await DropOffPoint.find({
        ...query,
        location: {
          $near: {
            $geometry: {
              type: 'Point',
              coordinates: [parseFloat(lng), parseFloat(lat)]
            },
            $maxDistance: radiusInMeters
          }
        }
      })
      .populate('manager', 'name phone email')
      .limit(parseInt(limit));
    } else {
      // Get all drop-off points without location filter
      dropOffPoints = await DropOffPoint.find(query)
        .populate('manager', 'name phone email')
        .limit(parseInt(limit));
    }

    res.json(dropOffPoints);
  } catch (error) {
    console.error('Get drop-off points error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get drop-off point by ID
router.get('/drop-off-points/:id', async (req, res) => {
  try {
    const dropOffPoint = await DropOffPoint.findById(req.params.id)
      .populate('manager', 'name phone email profilePicture');

    if (!dropOffPoint) {
      return res.status(404).json({ error: 'Drop-off point not found' });
    }

    res.json(dropOffPoint);
  } catch (error) {
    console.error('Get drop-off point error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Create new drop-off point (admin or verified users only)
router.post('/drop-off-points', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (user.role !== 'admin' && !user.verified) {
      return res.status(403).json({ error: 'Admin access or verified user status required' });
    }

    const {
      name,
      description,
      address,
      coordinates,
      categories,
      capacity,
      operatingHours,
      contactInfo,
      accessibility,
      instructions
    } = req.body;

    if (!name || !address || !coordinates || !coordinates.lat || !coordinates.lng) {
      return res.status(400).json({ error: 'Name, address, and coordinates are required' });
    }

    const dropOffPoint = new DropOffPoint({
      name,
      description,
      address,
      location: {
        type: 'Point',
        coordinates: [coordinates.lng, coordinates.lat]
      },
      categories: categories || [],
      capacity: capacity || { max: 100, current: 0 },
      operatingHours: operatingHours || {
        monday: { open: '09:00', close: '17:00', closed: false },
        tuesday: { open: '09:00', close: '17:00', closed: false },
        wednesday: { open: '09:00', close: '17:00', closed: false },
        thursday: { open: '09:00', close: '17:00', closed: false },
        friday: { open: '09:00', close: '17:00', closed: false },
        saturday: { open: '10:00', close: '16:00', closed: false },
        sunday: { open: '10:00', close: '16:00', closed: false }
      },
      contactInfo: contactInfo || {},
      accessibility: accessibility || {
        wheelchairAccessible: false,
        publicTransport: false,
        parking: false
      },
      instructions,
      manager: req.user.id,
      active: true
    });

    await dropOffPoint.save();
    await dropOffPoint.populate('manager', 'name phone email');

    res.status(201).json(dropOffPoint);
  } catch (error) {
    console.error('Create drop-off point error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update drop-off point
router.put('/drop-off-points/:id', auth, async (req, res) => {
  try {
    const dropOffPoint = await DropOffPoint.findById(req.params.id);
    if (!dropOffPoint) {
      return res.status(404).json({ error: 'Drop-off point not found' });
    }

    const user = await User.findById(req.user.id);
    // Check if user is manager or admin
    if (dropOffPoint.manager.toString() !== req.user.id && user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const {
      name,
      description,
      address,
      coordinates,
      categories,
      capacity,
      operatingHours,
      contactInfo,
      accessibility,
      instructions,
      active
    } = req.body;

    // Update fields
    if (name) dropOffPoint.name = name;
    if (description) dropOffPoint.description = description;
    if (address) dropOffPoint.address = address;
    if (coordinates && coordinates.lat && coordinates.lng) {
      dropOffPoint.location = {
        type: 'Point',
        coordinates: [coordinates.lng, coordinates.lat]
      };
    }
    if (categories) dropOffPoint.categories = categories;
    if (capacity) dropOffPoint.capacity = { ...dropOffPoint.capacity, ...capacity };
    if (operatingHours) dropOffPoint.operatingHours = { ...dropOffPoint.operatingHours, ...operatingHours };
    if (contactInfo) dropOffPoint.contactInfo = { ...dropOffPoint.contactInfo, ...contactInfo };
    if (accessibility) dropOffPoint.accessibility = { ...dropOffPoint.accessibility, ...accessibility };
    if (instructions) dropOffPoint.instructions = instructions;
    if (active !== undefined) dropOffPoint.active = active;

    await dropOffPoint.save();
    await dropOffPoint.populate('manager', 'name phone email');

    res.json(dropOffPoint);
  } catch (error) {
    console.error('Update drop-off point error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete drop-off point
router.delete('/drop-off-points/:id', auth, async (req, res) => {
  try {
    const dropOffPoint = await DropOffPoint.findById(req.params.id);
    if (!dropOffPoint) {
      return res.status(404).json({ error: 'Drop-off point not found' });
    }

    const user = await User.findById(req.user.id);
    // Check if user is manager or admin
    if (dropOffPoint.manager.toString() !== req.user.id && user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    await DropOffPoint.findByIdAndDelete(req.params.id);
    res.json({ message: 'Drop-off point deleted successfully' });
  } catch (error) {
    console.error('Delete drop-off point error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get nearby resources
router.get('/nearby-resources', async (req, res) => {
  try {
    const { lat, lng, radius = 5, category, limit = 20 } = req.query;

    if (!lat || !lng) {
      return res.status(400).json({ error: 'Latitude and longitude are required' });
    }

    const radiusInMeters = parseFloat(radius) * 1000; // Convert km to meters

    let query = {
      available: true,
      location: {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [parseFloat(lng), parseFloat(lat)]
          },
          $maxDistance: radiusInMeters
        }
      }
    };

    if (category) {
      query.category = category;
    }

    const resources = await Resource.find(query)
      .populate('donor', 'name profilePicture')
      .limit(parseInt(limit));

    // Calculate distances
    const resourcesWithDistance = resources.map(resource => {
      const distance = calculateDistance(
        parseFloat(lat),
        parseFloat(lng),
        resource.location.coordinates[1],
        resource.location.coordinates[0]
      );

      return {
        ...resource.toObject(),
        distance: Math.round(distance * 100) / 100 // Round to 2 decimal places
      };
    });

    res.json(resourcesWithDistance);
  } catch (error) {
    console.error('Get nearby resources error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get nearby users
router.get('/nearby-users', auth, async (req, res) => {
  try {
    const { lat, lng, radius = 5, role, limit = 20 } = req.query;

    if (!lat || !lng) {
      return res.status(400).json({ error: 'Latitude and longitude are required' });
    }

    const radiusInMeters = parseFloat(radius) * 1000; // Convert km to meters

    let query = {
      _id: { $ne: req.user.id }, // Exclude current user
      location: {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [parseFloat(lng), parseFloat(lat)]
          },
          $maxDistance: radiusInMeters
        }
      }
    };

    if (role) {
      query.role = role;
    }

    const users = await User.find(query)
      .select('name profilePicture role location bio')
      .limit(parseInt(limit));

    // Calculate distances
    const usersWithDistance = users.map(user => {
      const distance = calculateDistance(
        parseFloat(lat),
        parseFloat(lng),
        user.location.coordinates[1],
        user.location.coordinates[0]
      );

      return {
        ...user.toObject(),
        distance: Math.round(distance * 100) / 100 // Round to 2 decimal places
      };
    });

    res.json(usersWithDistance);
  } catch (error) {
    console.error('Get nearby users error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update drop-off point capacity
router.put('/drop-off-points/:id/capacity', auth, async (req, res) => {
  try {
    const { current } = req.body;

    if (typeof current !== 'number') {
      return res.status(400).json({ error: 'Current capacity must be a number' });
    }

    const dropOffPoint = await DropOffPoint.findById(req.params.id);
    if (!dropOffPoint) {
      return res.status(404).json({ error: 'Drop-off point not found' });
    }

    const user = await User.findById(req.user.id);
    // Check if user is manager or admin
    if (dropOffPoint.manager.toString() !== req.user.id && user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    dropOffPoint.capacity.current = current;
    await dropOffPoint.save();

    res.json({ 
      message: 'Capacity updated successfully',
      capacity: dropOffPoint.capacity 
    });
  } catch (error) {
    console.error('Update capacity error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get drop-off point statistics
router.get('/drop-off-points/:id/stats', auth, async (req, res) => {
  try {
    const dropOffPoint = await DropOffPoint.findById(req.params.id);
    if (!dropOffPoint) {
      return res.status(404).json({ error: 'Drop-off point not found' });
    }

    const user = await User.findById(req.user.id);
    // Check if user is manager or admin
    if (dropOffPoint.manager.toString() !== req.user.id && user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Calculate statistics
    const stats = {
      capacity: dropOffPoint.capacity,
      utilizationRate: dropOffPoint.capacity.max > 0 
        ? (dropOffPoint.capacity.current / dropOffPoint.capacity.max) * 100 
        : 0,
      categories: dropOffPoint.categories.length,
      active: dropOffPoint.active,
      createdAt: dropOffPoint.createdAt,
      lastUpdated: dropOffPoint.updatedAt
    };

    res.json(stats);
  } catch (error) {
    console.error('Get drop-off point stats error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Geocoding helper endpoint (for address to coordinates)
router.post('/geocode', auth, async (req, res) => {
  try {
    const { address } = req.body;

    if (!address) {
      return res.status(400).json({ error: 'Address is required' });
    }

    // This is a basic implementation
    // In production, you would use a real geocoding service like Google Maps API
    const mockCoordinates = {
      lat: -1.2921 + (Math.random() - 0.5) * 0.1, // Nairobi area with some randomness
      lng: 36.8219 + (Math.random() - 0.5) * 0.1
    };

    res.json({
      address,
      coordinates: mockCoordinates,
      source: 'mock' // Indicates this is mock data
    });
  } catch (error) {
    console.error('Geocoding error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Helper function to calculate distance between two points
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Radius of the Earth in kilometers
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  const d = R * c; // Distance in kilometers
  return d;
}

function deg2rad(deg) {
  return deg * (Math.PI/180);
}

module.exports = router;