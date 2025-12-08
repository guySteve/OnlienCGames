// src/routes/admin.js
const express = require('express');
const { prisma } = require('../db');
const { isAdmin } = require('../middleware/auth');

const router = express.Router();

router.use(isAdmin);

router.get('/dashboard', async (req, res) => {
    // ... implementation from server.js
});

router.get('/users', async (req, res) => {
    // ... implementation from server.js
});

// ... all other admin routes

module.exports = router;
