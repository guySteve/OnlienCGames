// src/middleware/operatingHours.js

/**
 * Operating Hours Middleware
 * Casino is now ALWAYS OPEN - no time restrictions
 */
function checkOperatingHours(req, res, next) {
    // Casino is always open - proceed with all requests
    return next();
}

/**
 * Legacy function for backward compatibility
 * Returns status indicating casino is always open
 */
function getOperatingHoursStatus() {
    return {
        isOpen: true,
        nextOpenTime: null
    };
}

module.exports = {
    checkOperatingHours,
    getOperatingHoursStatus
};
