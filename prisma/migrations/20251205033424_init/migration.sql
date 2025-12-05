-- CreateEnum
CREATE TYPE "ModAction" AS ENUM ('WARN', 'MUTE', 'KICK', 'BAN', 'UNBAN', 'MESSAGE_DELETED', 'AUTO_FILTER');

-- CreateEnum
CREATE TYPE "FriendshipStatus" AS ENUM ('PENDING', 'ACCEPTED', 'BLOCKED');

-- CreateEnum
CREATE TYPE "InviteStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "SyndicateRole" AS ENUM ('MEMBER', 'OFFICER', 'LEADER');

-- CreateEnum
CREATE TYPE "SyndicateTransactionType" AS ENUM ('TAX_CONTRIBUTION', 'MANUAL_DONATION', 'DIVIDEND_PAYOUT', 'LEADER_WITHDRAWAL', 'REFERRAL_BONUS', 'WEEKLY_RESET');

-- CreateEnum
CREATE TYPE "ReferralStatus" AS ENUM ('PENDING', 'ACTIVATED', 'COMPLETED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "PatronTier" AS ENUM ('SUPPORTER', 'BENEFACTOR', 'PHILANTHROPIST', 'LEGEND');

-- CreateEnum
CREATE TYPE "HappyHourBonus" AS ENUM ('XP_BOOST', 'CHIP_BOOST', 'MYSTERY_BOOST', 'STREAK_PROTECT');

-- AlterEnum
ALTER TYPE "GameType" ADD VALUE 'BINGO';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "TransactionType" ADD VALUE 'TRANSFER_SENT';
ALTER TYPE "TransactionType" ADD VALUE 'TRANSFER_RECEIVED';
ALTER TYPE "TransactionType" ADD VALUE 'TIP';

-- AlterTable
ALTER TABLE "GameSession" ADD COLUMN     "playerSeed" TEXT,
ADD COLUMN     "serverSeed" TEXT;

-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "relatedUserId" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "banReason" TEXT,
ADD COLUMN     "bannedAt" TIMESTAMP(3),
ADD COLUMN     "bannedBy" TEXT,
ADD COLUMN     "ipAddress" TEXT,
ADD COLUMN     "isAdmin" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isBanned" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "lastTipDate" TIMESTAMP(3),
ADD COLUMN     "lastWarningAt" TIMESTAMP(3),
ADD COLUMN     "needsAvatarSetup" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "referralCode" TEXT,
ADD COLUMN     "referredBy" TEXT,
ADD COLUMN     "tipStreak" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "totalTipped" BIGINT NOT NULL DEFAULT 0,
ADD COLUMN     "userAgent" TEXT,
ADD COLUMN     "warnCount" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "ChatMessage" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,
    "roomId" TEXT,
    "message" TEXT NOT NULL,
    "isFiltered" BOOLEAN NOT NULL DEFAULT false,
    "isFlagged" BOOLEAN NOT NULL DEFAULT false,
    "flagReason" TEXT,

    CONSTRAINT "ChatMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModerationLog" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "moderatorId" TEXT,
    "userId" TEXT NOT NULL,
    "action" "ModAction" NOT NULL,
    "reason" TEXT,
    "details" JSONB,
    "autoModerated" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ModerationLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Friendship" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,
    "friendId" TEXT NOT NULL,
    "status" "FriendshipStatus" NOT NULL DEFAULT 'PENDING',

    CONSTRAINT "Friendship_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TableInvite" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "roomId" TEXT NOT NULL,
    "fromUserId" TEXT NOT NULL,
    "toUserId" TEXT NOT NULL,
    "status" "InviteStatus" NOT NULL DEFAULT 'PENDING',
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TableInvite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Syndicate" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "name" VARCHAR(30) NOT NULL,
    "tag" VARCHAR(6) NOT NULL,
    "description" VARCHAR(500),
    "iconUrl" VARCHAR(500),
    "bannerUrl" VARCHAR(500),
    "treasuryBalance" BIGINT NOT NULL DEFAULT 0,
    "lifetimeEarnings" BIGINT NOT NULL DEFAULT 0,
    "taxRate" DOUBLE PRECISION NOT NULL DEFAULT 0.01,
    "totalMembers" INTEGER NOT NULL DEFAULT 1,
    "totalWins" BIGINT NOT NULL DEFAULT 0,
    "weeklyXP" INTEGER NOT NULL DEFAULT 0,
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "minLevelToJoin" INTEGER NOT NULL DEFAULT 1,
    "maxMembers" INTEGER NOT NULL DEFAULT 50,

    CONSTRAINT "Syndicate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyndicateMember" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "syndicateId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "SyndicateRole" NOT NULL DEFAULT 'MEMBER',
    "contributedChips" BIGINT NOT NULL DEFAULT 0,
    "weeklyContribution" BIGINT NOT NULL DEFAULT 0,
    "dividendsReceived" BIGINT NOT NULL DEFAULT 0,
    "lastActive" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "gamesPlayed" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "SyndicateMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyndicateTransaction" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "syndicateId" TEXT NOT NULL,
    "userId" TEXT,
    "amount" BIGINT NOT NULL,
    "type" "SyndicateTransactionType" NOT NULL,
    "balanceBefore" BIGINT NOT NULL,
    "balanceAfter" BIGINT NOT NULL,
    "description" TEXT,
    "metadata" JSONB,

    CONSTRAINT "SyndicateTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyndicateDividend" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "syndicateId" TEXT NOT NULL,
    "totalAmount" BIGINT NOT NULL,
    "memberCount" INTEGER NOT NULL,
    "amountPerMember" BIGINT NOT NULL,
    "minContribution" BIGINT NOT NULL DEFAULT 0,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "metadata" JSONB,

    CONSTRAINT "SyndicateDividend_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyndicateInvite" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "syndicateId" TEXT NOT NULL,
    "fromUserId" TEXT NOT NULL,
    "toUserId" TEXT NOT NULL,
    "status" "InviteStatus" NOT NULL DEFAULT 'PENDING',
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SyndicateInvite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Referral" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "referrerId" TEXT NOT NULL,
    "refereeId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "syndicateId" TEXT,
    "syndicateBonusPaid" BIGINT NOT NULL DEFAULT 0,
    "referrerReward" BIGINT NOT NULL DEFAULT 0,
    "refereeReward" BIGINT NOT NULL DEFAULT 0,
    "refereeFirstGame" TIMESTAMP(3),
    "refereeLevelFive" TIMESTAMP(3),
    "status" "ReferralStatus" NOT NULL DEFAULT 'PENDING',

    CONSTRAINT "Referral_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReferralCode" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,
    "code" VARCHAR(12) NOT NULL,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "maxUses" INTEGER,
    "referrerBonus" INTEGER NOT NULL DEFAULT 500,
    "refereeBonus" INTEGER NOT NULL DEFAULT 1000,
    "syndicateBonus" INTEGER NOT NULL DEFAULT 100,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "ReferralCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TipRecord" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "isAnonymous" BOOLEAN NOT NULL DEFAULT false,
    "message" VARCHAR(100),
    "weekNumber" INTEGER NOT NULL,
    "yearNumber" INTEGER NOT NULL,

    CONSTRAINT "TipRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PatronBadge" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "iconUrl" TEXT NOT NULL,
    "tier" "PatronTier" NOT NULL,
    "minTotalTips" BIGINT NOT NULL DEFAULT 0,
    "minWeeklyTips" INTEGER NOT NULL DEFAULT 0,
    "minTipStreak" INTEGER NOT NULL DEFAULT 0,
    "frameColor" TEXT,
    "chatBadge" TEXT,

    CONSTRAINT "PatronBadge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserPatronBadge" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,
    "badgeId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "UserPatronBadge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HappyHourSchedule" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dayOfWeek" INTEGER,
    "hourOfDay" INTEGER,
    "durationMinutes" INTEGER NOT NULL DEFAULT 60,
    "multiplier" DOUBLE PRECISION NOT NULL DEFAULT 1.5,
    "bonusType" "HappyHourBonus" NOT NULL DEFAULT 'XP_BOOST',
    "isRandom" BOOLEAN NOT NULL DEFAULT false,
    "minGapHours" INTEGER NOT NULL DEFAULT 4,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "HappyHourSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ChatMessage_userId_idx" ON "ChatMessage"("userId");

-- CreateIndex
CREATE INDEX "ChatMessage_roomId_idx" ON "ChatMessage"("roomId");

-- CreateIndex
CREATE INDEX "ChatMessage_createdAt_idx" ON "ChatMessage"("createdAt");

-- CreateIndex
CREATE INDEX "ChatMessage_isFlagged_idx" ON "ChatMessage"("isFlagged");

-- CreateIndex
CREATE INDEX "ModerationLog_userId_idx" ON "ModerationLog"("userId");

-- CreateIndex
CREATE INDEX "ModerationLog_moderatorId_idx" ON "ModerationLog"("moderatorId");

-- CreateIndex
CREATE INDEX "ModerationLog_createdAt_idx" ON "ModerationLog"("createdAt");

-- CreateIndex
CREATE INDEX "ModerationLog_action_idx" ON "ModerationLog"("action");

-- CreateIndex
CREATE INDEX "Friendship_userId_status_idx" ON "Friendship"("userId", "status");

-- CreateIndex
CREATE INDEX "Friendship_friendId_status_idx" ON "Friendship"("friendId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Friendship_userId_friendId_key" ON "Friendship"("userId", "friendId");

-- CreateIndex
CREATE INDEX "TableInvite_toUserId_status_idx" ON "TableInvite"("toUserId", "status");

-- CreateIndex
CREATE INDEX "TableInvite_roomId_idx" ON "TableInvite"("roomId");

-- CreateIndex
CREATE UNIQUE INDEX "Syndicate_name_key" ON "Syndicate"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Syndicate_tag_key" ON "Syndicate"("tag");

-- CreateIndex
CREATE INDEX "Syndicate_name_idx" ON "Syndicate"("name");

-- CreateIndex
CREATE INDEX "Syndicate_isPublic_minLevelToJoin_idx" ON "Syndicate"("isPublic", "minLevelToJoin");

-- CreateIndex
CREATE INDEX "Syndicate_weeklyXP_idx" ON "Syndicate"("weeklyXP");

-- CreateIndex
CREATE UNIQUE INDEX "SyndicateMember_userId_key" ON "SyndicateMember"("userId");

-- CreateIndex
CREATE INDEX "SyndicateMember_userId_idx" ON "SyndicateMember"("userId");

-- CreateIndex
CREATE INDEX "SyndicateMember_syndicateId_role_idx" ON "SyndicateMember"("syndicateId", "role");

-- CreateIndex
CREATE INDEX "SyndicateMember_syndicateId_weeklyContribution_idx" ON "SyndicateMember"("syndicateId", "weeklyContribution");

-- CreateIndex
CREATE UNIQUE INDEX "SyndicateMember_syndicateId_userId_key" ON "SyndicateMember"("syndicateId", "userId");

-- CreateIndex
CREATE INDEX "SyndicateTransaction_syndicateId_createdAt_idx" ON "SyndicateTransaction"("syndicateId", "createdAt");

-- CreateIndex
CREATE INDEX "SyndicateTransaction_userId_idx" ON "SyndicateTransaction"("userId");

-- CreateIndex
CREATE INDEX "SyndicateTransaction_type_idx" ON "SyndicateTransaction"("type");

-- CreateIndex
CREATE INDEX "SyndicateDividend_syndicateId_createdAt_idx" ON "SyndicateDividend"("syndicateId", "createdAt");

-- CreateIndex
CREATE INDEX "SyndicateInvite_toUserId_status_idx" ON "SyndicateInvite"("toUserId", "status");

-- CreateIndex
CREATE INDEX "SyndicateInvite_syndicateId_idx" ON "SyndicateInvite"("syndicateId");

-- CreateIndex
CREATE UNIQUE INDEX "Referral_refereeId_key" ON "Referral"("refereeId");

-- CreateIndex
CREATE INDEX "Referral_referrerId_idx" ON "Referral"("referrerId");

-- CreateIndex
CREATE INDEX "Referral_code_idx" ON "Referral"("code");

-- CreateIndex
CREATE INDEX "Referral_syndicateId_idx" ON "Referral"("syndicateId");

-- CreateIndex
CREATE UNIQUE INDEX "ReferralCode_code_key" ON "ReferralCode"("code");

-- CreateIndex
CREATE INDEX "ReferralCode_userId_idx" ON "ReferralCode"("userId");

-- CreateIndex
CREATE INDEX "ReferralCode_code_idx" ON "ReferralCode"("code");

-- CreateIndex
CREATE INDEX "TipRecord_userId_idx" ON "TipRecord"("userId");

-- CreateIndex
CREATE INDEX "TipRecord_yearNumber_weekNumber_idx" ON "TipRecord"("yearNumber", "weekNumber");

-- CreateIndex
CREATE INDEX "TipRecord_createdAt_idx" ON "TipRecord"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PatronBadge_key_key" ON "PatronBadge"("key");

-- CreateIndex
CREATE INDEX "PatronBadge_tier_idx" ON "PatronBadge"("tier");

-- CreateIndex
CREATE INDEX "UserPatronBadge_userId_idx" ON "UserPatronBadge"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserPatronBadge_userId_badgeId_key" ON "UserPatronBadge"("userId", "badgeId");

-- CreateIndex
CREATE INDEX "HappyHourSchedule_isActive_dayOfWeek_hourOfDay_idx" ON "HappyHourSchedule"("isActive", "dayOfWeek", "hourOfDay");

-- CreateIndex
CREATE INDEX "Transaction_relatedUserId_idx" ON "Transaction"("relatedUserId");

-- CreateIndex
CREATE INDEX "User_isBanned_idx" ON "User"("isBanned");

-- CreateIndex
CREATE INDEX "User_isAdmin_idx" ON "User"("isAdmin");

-- AddForeignKey
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModerationLog" ADD CONSTRAINT "ModerationLog_moderatorId_fkey" FOREIGN KEY ("moderatorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModerationLog" ADD CONSTRAINT "ModerationLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Friendship" ADD CONSTRAINT "Friendship_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Friendship" ADD CONSTRAINT "Friendship_friendId_fkey" FOREIGN KEY ("friendId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SyndicateMember" ADD CONSTRAINT "SyndicateMember_syndicateId_fkey" FOREIGN KEY ("syndicateId") REFERENCES "Syndicate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SyndicateMember" ADD CONSTRAINT "SyndicateMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SyndicateTransaction" ADD CONSTRAINT "SyndicateTransaction_syndicateId_fkey" FOREIGN KEY ("syndicateId") REFERENCES "Syndicate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SyndicateDividend" ADD CONSTRAINT "SyndicateDividend_syndicateId_fkey" FOREIGN KEY ("syndicateId") REFERENCES "Syndicate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SyndicateInvite" ADD CONSTRAINT "SyndicateInvite_syndicateId_fkey" FOREIGN KEY ("syndicateId") REFERENCES "Syndicate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Referral" ADD CONSTRAINT "Referral_referrerId_fkey" FOREIGN KEY ("referrerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Referral" ADD CONSTRAINT "Referral_refereeId_fkey" FOREIGN KEY ("refereeId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReferralCode" ADD CONSTRAINT "ReferralCode_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TipRecord" ADD CONSTRAINT "TipRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPatronBadge" ADD CONSTRAINT "UserPatronBadge_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPatronBadge" ADD CONSTRAINT "UserPatronBadge_badgeId_fkey" FOREIGN KEY ("badgeId") REFERENCES "PatronBadge"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
