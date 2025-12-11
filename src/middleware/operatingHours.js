// src/middleware/operatingHours.js

function getCurrentEasternTime() {
    const now = new Date();
    const month = now.getUTCMonth(); // 0-11
    const isDST = month >= 2 && month <= 10;
    const etOffset = isDST ? -4 : -5;
    const etDate = new Date(now.getTime() + etOffset * 3600 * 1000);
    const etHour = etDate.getUTCHours();
    return { etDate, etHour };
}

function getOperatingHoursStatus() {
    const { etDate, etHour } = getCurrentEasternTime();
    const isOpen = etHour >= 22 || etHour < 2;
    const nextOpenTime = new Date(etDate);
    nextOpenTime.setUTCHours(22, 0, 0, 0);
    if (etHour >= 22) {
        nextOpenTime.setUTCDate(nextOpenTime.getUTCDate() + 1);
    }
    return { isOpen, nextOpenTime };
}

function checkOperatingHours(req, res, next) {
    // ALWAYS OPEN - No time restrictions
    const allowedPaths = [
        '/health', '/auth', '/me', '/api/card-room-status', '/logout', '/', '/index.html',
        '/assets', '/vite', '/@vite', '/node_modules', '/src', '/socket.io'
    ];

    if (allowedPaths.some(p => req.path === p || req.path.startsWith(p)) || 
        req.path.match(/\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot|json|jsx|ts|tsx)$/)) {
        return next();
    }

    // Always allow access - casino is always open
    return next();
}

module.exports = {
    getCurrentEasternTime,
    getOperatingHoursStatus,
    checkOperatingHours
};
