// src/routes/profile.js
const express = require('express');
const { prisma } = require('../db');
const router = express.Router();

// Middleware to ensure user is authenticated
const requireAuth = (req, res, next) => {
  if (!req.user || !req.user.id) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  next();
};

// Update user profile (display name)
router.post('/update', requireAuth, async (req, res) => {
  try {
    const { displayName } = req.body;
    const userId = req.user.id;

    // Validation
    if (!displayName || displayName.trim().length === 0) {
      return res.status(400).json({ error: 'Display name is required' });
    }

    if (displayName.length > 30) {
      return res.status(400).json({ error: 'Display name must be 30 characters or less' });
    }

    // Update user
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        displayName: displayName.trim(),
        updatedAt: new Date()
      }
    });

    res.json({
      success: true,
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        displayName: updatedUser.displayName
      }
    });
  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

module.exports = router;
