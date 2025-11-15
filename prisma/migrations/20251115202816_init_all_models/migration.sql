-- CreateTable
CREATE TABLE IF NOT EXISTS "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT,
    "name" TEXT,
    "username" TEXT,
    "profilePicture" TEXT,
    "deviceId" TEXT,
    "supabaseId" TEXT,
    "revenueCatUserId" TEXT,
    "isGuest" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastSyncAt" TIMESTAMP(3),
    "goal" TEXT,
    "timeline" TEXT,
    "timeCommitment" TEXT,
    "answers" TEXT,
    "roadmap" TEXT,
    "completedTasks" TEXT,
    "streakData" TEXT,
    "taskTimers" TEXT,
    "subscriptionPlan" TEXT DEFAULT 'free',
    "subscriptionStatus" TEXT DEFAULT 'inactive',
    "subscriptionExpiresAt" TIMESTAMP(3),
    "subscriptionPurchasedAt" TIMESTAMP(3),
    "revenueCatCustomerInfo" TEXT,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "email_records" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "users_supabaseId_key" ON "users"("supabaseId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "users_revenueCatUserId_key" ON "users"("revenueCatUserId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "email_records_email_idx" ON "email_records"("email");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "email_records_userId_idx" ON "email_records"("userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "email_records_source_idx" ON "email_records"("source");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "email_records_createdAt_idx" ON "email_records"("createdAt");

