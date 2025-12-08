-- AlterTable
ALTER TABLE "User" ALTER COLUMN "chipBalance" SET DEFAULT 100;

-- CreateTable
CREATE TABLE "DeadDropMessage" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "fromUserId" TEXT NOT NULL,
    "toUserId" TEXT NOT NULL,
    "encryptedContent" TEXT NOT NULL,
    "viewed" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "DeadDropMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Authenticator" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,
    "credentialID" BYTEA NOT NULL,
    "credentialPublicKey" BYTEA NOT NULL,
    "counter" BIGINT NOT NULL DEFAULT 0,
    "transports" TEXT,
    "deviceName" VARCHAR(100),

    CONSTRAINT "Authenticator_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DeadDropMessage_toUserId_viewed_expiresAt_idx" ON "DeadDropMessage"("toUserId", "viewed", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "Authenticator_credentialID_key" ON "Authenticator"("credentialID");

-- CreateIndex
CREATE INDEX "Authenticator_userId_idx" ON "Authenticator"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Authenticator_userId_credentialID_key" ON "Authenticator"("userId", "credentialID");

-- AddForeignKey
ALTER TABLE "DeadDropMessage" ADD CONSTRAINT "DeadDropMessage_fromUserId_fkey" FOREIGN KEY ("fromUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeadDropMessage" ADD CONSTRAINT "DeadDropMessage_toUserId_fkey" FOREIGN KEY ("toUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Authenticator" ADD CONSTRAINT "Authenticator_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
