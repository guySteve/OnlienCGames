-- CreateEnum
CREATE TYPE "VipTier" AS ENUM ('BRONZE', 'SILVER', 'GOLD', 'PLATINUM', 'DIAMOND');

-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('BET', 'WIN', 'PUSH', 'DAILY_STREAK', 'MYSTERY_DROP', 'ACHIEVEMENT_REWARD', 'LEVEL_UP_BONUS', 'ADMIN_CREDIT', 'ADMIN_DEBIT', 'PROMO_CODE', 'REFUND', 'CORRECTION');

-- CreateEnum
CREATE TYPE "GameType" AS ENUM ('WAR', 'BLACKJACK');

-- CreateEnum
CREATE TYPE "HandResult" AS ENUM ('PLAYER_WIN', 'DEALER_WIN', 'TIE', 'BLACKJACK', 'PLAYER_BUST', 'DEALER_BUST');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "googleId" TEXT,
    "email" TEXT,
    "displayName" TEXT NOT NULL,
    "avatarUrl" TEXT,
    "nickname" VARCHAR(30),
    "customAvatar" VARCHAR(500),
    "chipBalance" BIGINT NOT NULL DEFAULT 1000,
    "totalWagered" BIGINT NOT NULL DEFAULT 0,
    "totalWon" BIGINT NOT NULL DEFAULT 0,
    "xpPoints" INTEGER NOT NULL DEFAULT 0,
    "xpLevel" INTEGER NOT NULL DEFAULT 1,
    "vipStatus" "VipTier" NOT NULL DEFAULT 'BRONZE',
    "lastLogin" TIMESTAMP(3),
    "currentStreak" INTEGER NOT NULL DEFAULT 0,
    "bestStreak" INTEGER NOT NULL DEFAULT 0,
    "nextStreakReward" TIMESTAMP(3),
    "streakFrozen" BOOLEAN NOT NULL DEFAULT false,
    "lastMysteryDrop" TIMESTAMP(3),
    "mysteryDropCount" INTEGER NOT NULL DEFAULT 0,
    "totalMysteryChips" BIGINT NOT NULL DEFAULT 0,
    "totalHandsPlayed" INTEGER NOT NULL DEFAULT 0,
    "lastHandPlayed" TIMESTAMP(3),
    "averageSessionMinutes" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "publicWins" INTEGER NOT NULL DEFAULT 0,
    "biggestWin" BIGINT NOT NULL DEFAULT 0,
    "biggestWinGameId" TEXT,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "type" "TransactionType" NOT NULL,
    "balanceBefore" BIGINT NOT NULL,
    "balanceAfter" BIGINT NOT NULL,
    "gameSessionId" TEXT,
    "description" TEXT,
    "metadata" JSONB,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GameSession" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "gameType" "GameType" NOT NULL,
    "roomId" TEXT NOT NULL,
    "hostUserId" TEXT NOT NULL,
    "initialDeckSeed" TEXT,
    "finalState" JSONB NOT NULL,
    "totalPot" INTEGER NOT NULL,
    "winners" JSONB NOT NULL,

    CONSTRAINT "GameSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Hand" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sessionId" TEXT NOT NULL,
    "handNumber" INTEGER NOT NULL,
    "playerCards" JSONB NOT NULL,
    "dealerCards" JSONB NOT NULL,
    "result" "HandResult" NOT NULL,
    "payouts" JSONB NOT NULL,

    CONSTRAINT "Hand_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Achievement" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "iconUrl" TEXT,
    "chipReward" INTEGER NOT NULL DEFAULT 0,
    "xpReward" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Achievement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserAchievement" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,
    "achievementId" TEXT NOT NULL,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "completed" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "UserAchievement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HappyHour" (
    "id" TEXT NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3) NOT NULL,
    "multiplier" DOUBLE PRECISION NOT NULL DEFAULT 1.5,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "HappyHour_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_googleId_key" ON "User"("googleId");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_googleId_idx" ON "User"("googleId");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_currentStreak_idx" ON "User"("currentStreak");

-- CreateIndex
CREATE INDEX "User_lastLogin_idx" ON "User"("lastLogin");

-- CreateIndex
CREATE INDEX "Transaction_userId_createdAt_idx" ON "Transaction"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Transaction_gameSessionId_idx" ON "Transaction"("gameSessionId");

-- CreateIndex
CREATE INDEX "Transaction_type_idx" ON "Transaction"("type");

-- CreateIndex
CREATE INDEX "GameSession_hostUserId_idx" ON "GameSession"("hostUserId");

-- CreateIndex
CREATE INDEX "GameSession_gameType_createdAt_idx" ON "GameSession"("gameType", "createdAt");

-- CreateIndex
CREATE INDEX "Hand_sessionId_handNumber_idx" ON "Hand"("sessionId", "handNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Achievement_key_key" ON "Achievement"("key");

-- CreateIndex
CREATE INDEX "UserAchievement_userId_completed_idx" ON "UserAchievement"("userId", "completed");

-- CreateIndex
CREATE UNIQUE INDEX "UserAchievement_userId_achievementId_key" ON "UserAchievement"("userId", "achievementId");

-- CreateIndex
CREATE INDEX "HappyHour_active_startTime_endTime_idx" ON "HappyHour"("active", "startTime", "endTime");

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_gameSessionId_fkey" FOREIGN KEY ("gameSessionId") REFERENCES "GameSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameSession" ADD CONSTRAINT "GameSession_hostUserId_fkey" FOREIGN KEY ("hostUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Hand" ADD CONSTRAINT "Hand_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "GameSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserAchievement" ADD CONSTRAINT "UserAchievement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserAchievement" ADD CONSTRAINT "UserAchievement_achievementId_fkey" FOREIGN KEY ("achievementId") REFERENCES "Achievement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
