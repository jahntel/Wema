const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const validator = require('validator');
const User = require('../models/User');
const { authenticate, authorize, validateLocation } = require('../middleware/auth');

const router = express.Router();

// Generate JWT token
const generateToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET || 'your-secret-key', {
    expiresIn: '24h'
  });
};

// Generate verification token
const generateVerificationToken = () => {
  return crypto.randomBytes(32).toString('hex');
};

// Register new user
router.post('/register', validateLocation, async (req, res) => {
  try {
    const {
      username,
      email,
      password,
      firstName,
      lastName,
      phoneNumber,
      location,
      role = 'receiver',
      preferredLanguage = 'en',
      accessibilityNeeds = {}
    } = req.body;

    // Validation
    if (!username || !email || !password || !firstName || !lastName || !phoneNumber) {
      return res.status(400).json({
        error: 'All required fields must be provided.'
      });
    }

    if (!validator.isEmail(email)) {
      return res.status(400).json({
        error: 'Invalid email format.'
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        error: 'Password must be at least 6 characters long.'
      });
    }

    if (!['donor', 'receiver', 'admin'].includes(role)) {
      return res.status(400).json({
        error: 'Invalid role. Must be donor, receiver, or admin.'
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({
      $or: [{ email }, { username }]
    });

    if (existingUser) {
      return res.status(400).json({
        error: 'User with this email or username already exists.'
      });
    }

    // Create verification token
    const verificationToken = generateVerificationToken();

    // Create new user
    const user = new User({
      username,
      email,
      password,
      firstName,
      lastName,
      phoneNumber,
      location,
      role,
      preferredLanguage,
      accessibilityNeeds,
      verificationToken
    });

    await user.save();

    // Generate JWT token
    const token = generateToken(user._id);

    // Remove password from response
    const userResponse = user.toObject();
    delete userResponse.password;
    delete userResponse.verificationToken;

    res.status(201).json({
      message: 'User registered successfully. Please verify your email.',
      user: userResponse,
      token,
      verificationRequired: true
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      error: 'Server error during registration.'
    });
  }
});

// User login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: 'Email and password are required.'
      });
    }

    // Find user by email
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(401).json({
        error: 'Invalid credentials.'
      });
    }

    // Check password
    const isValidPassword = await user.comparePassword(password);

    if (!isValidPassword) {
      return res.status(401).json({
        error: 'Invalid credentials.'
      });
    }

    // Update user online status
    user.isOnline = true;
    await user.save();

    // Generate JWT token
    const token = generateToken(user._id);

    // Remove password from response
    const userResponse = user.toObject();
    delete userResponse.password;

    res.json({
      message: 'Login successful.',
      user: userResponse,
      token,
      requiresVerification: !user.isVerified
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      error: 'Server error during login.'
    });
  }
});

// User logout
router.post('/logout', authenticate, async (req, res) => {
  try {
    // Update user online status
    req.user.isOnline = false;
    await req.user.save();

    res.json({
      message: 'Logout successful.'
    });

  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      error: 'Server error during logout.'
    });
  }
});

// Verify email
router.post('/verify-email', async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({
        error: 'Verification token is required.'
      });
    }

    const user = await User.findOne({ verificationToken: token });

    if (!user) {
      return res.status(400).json({
        error: 'Invalid or expired verification token.'
      });
    }

    // Update user verification status
    user.isVerified = true;
    user.verificationToken = undefined;
    await user.save();

    res.json({
      message: 'Email verified successfully.'
    });

  } catch (error) {
    console.error('Email verification error:', error);
    res.status(500).json({
      error: 'Server error during email verification.'
    });
  }
});

// Resend verification email
router.post('/resend-verification', authenticate, async (req, res) => {
  try {
    if (req.user.isVerified) {
      return res.status(400).json({
        error: 'Account is already verified.'
      });
    }

    // Generate new verification token
    const verificationToken = generateVerificationToken();
    req.user.verificationToken = verificationToken;
    await req.user.save();

    // Here you would send the verification email
    // For now, we'll just return the token
    res.json({
      message: 'Verification email sent.',
      verificationToken // Remove this in production
    });

  } catch (error) {
    console.error('Resend verification error:', error);
    res.status(500).json({
      error: 'Server error while resending verification email.'
    });
  }
});

// Request password reset
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        error: 'Email is required.'
      });
    }

    const user = await User.findOne({ email });

    if (!user) {
      // Don't reveal if user exists or not
      return res.json({
        message: 'If an account with this email exists, a password reset link has been sent.'
      });
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = Date.now() + 3600000; // 1 hour

    await user.save();

    // Here you would send the password reset email
    // For now, we'll just return the token
    res.json({
      message: 'If an account with this email exists, a password reset link has been sent.',
      resetToken // Remove this in production
    });

  } catch (error) {
    console.error('Password reset request error:', error);
    res.status(500).json({
      error: 'Server error while processing password reset request.'
    });
  }
});

// Reset password
router.post('/reset-password', async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({
        error: 'Token and new password are required.'
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        error: 'Password must be at least 6 characters long.'
      });
    }

    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({
        error: 'Invalid or expired reset token.'
      });
    }

    // Update password
    user.password = newPassword;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;

    await user.save();

    res.json({
      message: 'Password reset successful.'
    });

  } catch (error) {
    console.error('Password reset error:', error);
    res.status(500).json({
      error: 'Server error while resetting password.'
    });
  }
});

// Change password (authenticated)
router.post('/change-password', authenticate, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        error: 'Current password and new password are required.'
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        error: 'New password must be at least 6 characters long.'
      });
    }

    // Verify current password
    const isValidPassword = await req.user.comparePassword(currentPassword);

    if (!isValidPassword) {
      return res.status(400).json({
        error: 'Current password is incorrect.'
      });
    }

    // Update password
    req.user.password = newPassword;
    await req.user.save();

    res.json({
      message: 'Password changed successfully.'
    });

  } catch (error) {
    console.error('Password change error:', error);
    res.status(500).json({
      error: 'Server error while changing password.'
    });
  }
});

// Get current user profile
router.get('/profile', authenticate, async (req, res) => {
  try {
    const userResponse = req.user.toObject();
    delete userResponse.password;
    delete userResponse.verificationToken;
    delete userResponse.resetPasswordToken;
    delete userResponse.resetPasswordExpires;

    res.json({
      user: userResponse
    });

  } catch (error) {
    console.error('Profile fetch error:', error);
    res.status(500).json({
      error: 'Server error while fetching profile.'
    });
  }
});

// Update user profile
router.put('/profile', authenticate, async (req, res) => {
  try {
    const allowedUpdates = [
      'firstName', 'lastName', 'phoneNumber', 'bio',
      'preferredLanguage', 'accessibilityNeeds',
      'notificationPreferences'
    ];

    const updates = Object.keys(req.body);
    const isValidUpdate = updates.every(update => allowedUpdates.includes(update));

    if (!isValidUpdate) {
      return res.status(400).json({
        error: 'Invalid update fields.'
      });
    }

    // Apply updates
    updates.forEach(update => {
      req.user[update] = req.body[update];
    });

    await req.user.save();

    const userResponse = req.user.toObject();
    delete userResponse.password;
    delete userResponse.verificationToken;
    delete userResponse.resetPasswordToken;
    delete userResponse.resetPasswordExpires;

    res.json({
      message: 'Profile updated successfully.',
      user: userResponse
    });

  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({
      error: 'Server error while updating profile.'
    });
  }
});

// Update user location
router.put('/location', authenticate, validateLocation, async (req, res) => {
  try {
    const { location } = req.body;

    req.user.location = location;
    await req.user.save();

    res.json({
      message: 'Location updated successfully.',
      location: req.user.location
    });

  } catch (error) {
    console.error('Location update error:', error);
    res.status(500).json({
      error: 'Server error while updating location.'
    });
  }
});

// Delete user account
router.delete('/account', authenticate, async (req, res) => {
  try {
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({
        error: 'Password confirmation is required.'
      });
    }

    // Verify password
    const isValidPassword = await req.user.comparePassword(password);

    if (!isValidPassword) {
      return res.status(400).json({
        error: 'Password is incorrect.'
      });
    }

    // Delete user account
    await User.findByIdAndDelete(req.user._id);

    res.json({
      message: 'Account deleted successfully.'
    });

  } catch (error) {
    console.error('Account deletion error:', error);
    res.status(500).json({
      error: 'Server error while deleting account.'
    });
  }
});

// Admin: Get all users
router.get('/users', authenticate, authorize(['admin']), async (req, res) => {
  try {
    const { page = 1, limit = 10, role, isVerified } = req.query;

    const query = {};
    if (role) query.role = role;
    if (isVerified !== undefined) query.isVerified = isVerified === 'true';

    const users = await User.find(query)
      .select('-password -verificationToken -resetPasswordToken -resetPasswordExpires')
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort({ createdAt: -1 });

    const total = await User.countDocuments(query);

    res.json({
      users,
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      totalUsers: total
    });

  } catch (error) {
    console.error('Users fetch error:', error);
    res.status(500).json({
      error: 'Server error while fetching users.'
    });
  }
});

// Admin: Update user role
router.put('/users/:id/role', authenticate, authorize(['admin']), async (req, res) => {
  try {
    const { role } = req.body;

    if (!['donor', 'receiver', 'admin'].includes(role)) {
      return res.status(400).json({
        error: 'Invalid role.'
      });
    }

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { role },
      { new: true }
    ).select('-password -verificationToken -resetPasswordToken -resetPasswordExpires');

    if (!user) {
      return res.status(404).json({
        error: 'User not found.'
      });
    }

    res.json({
      message: 'User role updated successfully.',
      user
    });

  } catch (error) {
    console.error('Role update error:', error);
    res.status(500).json({
      error: 'Server error while updating user role.'
    });
  }
});

module.exports = router;