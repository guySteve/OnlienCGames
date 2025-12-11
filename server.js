// server.js
console.log('Starting server.js...');
require('dotenv').config();
const http = require('http');
const { Server } = require('socket.io');
const { app, sessionMiddleware } = require('./app');
const { initializeSocket } = require('./src/socket');


const PORT = process.env.PORT || 8080;

const serverHttp = http.createServer(app);

const io = new Server(serverHttp, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST']
    }
});

initializeSocket(io, sessionMiddleware);

async function startServer() {
    try {
        console.log('Attempting to start HTTP server...');
        await new Promise((resolve, reject) => {
            serverHttp.listen(PORT, () => {
                console.log(`✅ Server listening on port ${PORT}`);
                resolve();
            });
            serverHttp.on('error', (err) => {
                reject(err);
            });
        });

    } catch (err) {
        console.error('❌ Fatal startup error:', err);
        // Do not exit; keep server running for health checks
    }
}

startServer();