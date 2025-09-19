-- AlterTable
ALTER TABLE "public"."User" ADD COLUMN     "onboardingCompletedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "public"."onboarding_progress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "profileData" TEXT,
    "instrumentsData" TEXT,
    "agentData" TEXT,
    "endpointsData" TEXT,
    "teamData" TEXT,
    "completedSteps" TEXT[],
    "currentStep" TEXT NOT NULL DEFAULT 'role',
    "isCompleted" BOOLEAN NOT NULL DEFAULT false,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "onboarding_progress_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "onboarding_progress_userId_key" ON "public"."onboarding_progress"("userId");

-- CreateIndex
CREATE INDEX "onboarding_progress_userId_idx" ON "public"."onboarding_progress"("userId");

-- CreateIndex
CREATE INDEX "onboarding_progress_isCompleted_idx" ON "public"."onboarding_progress"("isCompleted");

-- AddForeignKey
ALTER TABLE "public"."onboarding_progress" ADD CONSTRAINT "onboarding_progress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
