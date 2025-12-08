// src/middleware/auth.js
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'smmohamed60@gmail.com';

function isAdmin(req, res, next) {
    if (!req.user) {
        return res.status(401).json({ error: 'Not authenticated' });
    }
    if (req.user.email !== ADMIN_EMAIL) {
        return res.status(403).json({ error: 'Admin access required' });
    }
    next();
}

module.exports = { isAdmin };
