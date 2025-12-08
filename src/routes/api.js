// src/routes/api.js
const express = require('express');
const { prisma } = require('../db');
const { EngagementService } = require('../services/EngagementService');
const { getOperatingHoursStatus } = require('../middleware/operatingHours');
const { getSyndicateService, getReferralService, getGenerosityService, getEngagementServiceV2 } = require('../services/SyndicateService');

const router = express.Router();

router.get('/casino-status', (req, res) => {
    const { isOpen, nextOpenTime } = getOperatingHoursStatus();
    const now = Date.now();
    const msUntilOpen = isOpen ? 0 : Math.max(0, nextOpenTime.getTime() - now);
    res.json({ isOpen, nextOpenTime: nextOpenTime.toISOString(), msUntilOpen });
});

router.post('/profile', express.json(), async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
  // ... (implementation from server.js)
});

router.post('/daily-reward', async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
  // ... (implementation from server.js)
});

// All other non-auth, non-admin API routes from server.js should be here...

module.exports = router;