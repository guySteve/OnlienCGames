// server.js
require('dotenv').config();
const http = require('http');
const { Server } = require('socket.io');
const { app, sessionMiddleware } = require('./app');
const { initializeSocket } = require('./src/socket');
const { initializeAuth } = require('./src/auth');
const { checkDatabaseConnection } = require('./src/db');
const { initSyndicateService, initReferralService, initGenerosityService, initEngagementServiceV2 } = require('./src/services/SyndicateService');
const { createDividendDistributor } = require('./src/jobs/DividendDistributor');
const { createHappyHourScheduler } = require('./src/jobs/HappyHourScheduler');

const PORT = process.env.PORT || 3000;

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
        // Start listening immediately so platform health checks succeed
        serverHttp.listen(PORT, () => {
            console.log(`✅ Server listening on port ${PORT}`);
        });

        // Perform initialization asynchronously; failures are logged but don't block startup
        initializeAuth().catch(err => console.error('Auth init error:', err));
        checkDatabaseConnection().then((dbConnected) => {
            if (dbConnected) {
                const redisClient = require('./src/redis').redisClient;
                try {
                    initSyndicateService(prisma, redisClient, io);
                    initReferralService(prisma, redisClient, getSyndicateService());
                    initGenerosityService(prisma, redisClient, io);
                    initEngagementServiceV2(prisma, redisClient, getSyndicateService());

                    const dividendDistributor = createDividendDistributor(prisma, redisClient, getSyndicateService(), io);
                    dividendDistributor.start();

                    const happyHourScheduler = createHappyHourScheduler(prisma, redisClient, io);
                    happyHourScheduler.start();
                } catch (svcErr) {
                    console.error('Service init error:', svcErr);
                }
            }
        }).catch(err => console.error('DB check error:', err));

    } catch (err) {
        console.error('❌ Fatal startup error:', err);
        // Do not exit; keep server running for health checks
    }
}

startServer();