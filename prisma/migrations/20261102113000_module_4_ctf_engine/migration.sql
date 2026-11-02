-- CreateEnum
CREATE TYPE "ChallengeDifficulty" AS ENUM ('BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'EXPERT');

-- CreateEnum
CREATE TYPE "ChallengePublicationStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ChallengeAttemptStatus" AS ENUM ('ACTIVE', 'SOLVED', 'STOPPED');

-- CreateEnum
CREATE TYPE "FlagSubmissionResult" AS ENUM ('CORRECT', 'INCORRECT');

-- CreateTable
CREATE TABLE "categories" (
    "id" UUID NOT NULL,
    "slug" VARCHAR(100) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "challenges" (
    "id" UUID NOT NULL,
    "slug" VARCHAR(120) NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "description" TEXT NOT NULL,
    "category_id" UUID NOT NULL,
    "difficulty" "ChallengeDifficulty" NOT NULL,
    "points" INTEGER NOT NULL,
    "status" "ChallengePublicationStatus" NOT NULL DEFAULT 'DRAFT',
    "learning_objectives" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "available_from" TIMESTAMP(3),
    "available_until" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "challenges_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "challenges_points_positive" CHECK ("points" > 0),
    CONSTRAINT "challenges_availability_ordered" CHECK (
        "available_from" IS NULL OR "available_until" IS NULL OR "available_until" > "available_from"
    )
);

-- CreateTable
CREATE TABLE "challenge_secrets" (
    "challenge_id" UUID NOT NULL,
    "verifier_hash" VARCHAR(128) NOT NULL,
    "verifier_key_version" VARCHAR(50) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "challenge_secrets_pkey" PRIMARY KEY ("challenge_id")
);

-- CreateTable
CREATE TABLE "challenge_attempts" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "challenge_id" UUID NOT NULL,
    "status" "ChallengeAttemptStatus" NOT NULL DEFAULT 'ACTIVE',
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "solved_at" TIMESTAMP(3),
    "stopped_at" TIMESTAMP(3),

    CONSTRAINT "challenge_attempts_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "challenge_attempts_lifecycle_timestamps" CHECK (
        ("status" = 'ACTIVE' AND "solved_at" IS NULL AND "stopped_at" IS NULL)
        OR ("status" = 'SOLVED' AND "solved_at" IS NOT NULL AND "stopped_at" IS NULL)
        OR ("status" = 'STOPPED' AND "solved_at" IS NULL AND "stopped_at" IS NOT NULL)
    )
);

-- CreateTable
CREATE TABLE "flag_submissions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "challenge_id" UUID NOT NULL,
    "attempt_id" UUID NOT NULL,
    "result" "FlagSubmissionResult" NOT NULL,
    "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "flag_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "challenge_solves" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "challenge_id" UUID NOT NULL,
    "points_awarded" INTEGER NOT NULL,
    "solved_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "challenge_solves_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "challenge_solves_points_positive" CHECK ("points_awarded" > 0)
);

-- CreateIndex
CREATE UNIQUE INDEX "categories_slug_key" ON "categories"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "challenges_slug_key" ON "challenges"("slug");

-- CreateIndex
CREATE INDEX "challenges_category_id_status_difficulty_idx" ON "challenges"("category_id", "status", "difficulty");

-- CreateIndex
CREATE INDEX "challenges_status_available_from_available_until_idx" ON "challenges"("status", "available_from", "available_until");

-- CreateIndex
CREATE INDEX "challenge_attempts_user_id_challenge_id_status_idx" ON "challenge_attempts"("user_id", "challenge_id", "status");

-- CreateIndex
CREATE INDEX "challenge_attempts_user_id_started_at_idx" ON "challenge_attempts"("user_id", "started_at");

-- CreateIndex
CREATE UNIQUE INDEX "challenge_attempts_id_user_id_challenge_id_key" ON "challenge_attempts"("id", "user_id", "challenge_id");

-- CreateIndex
CREATE INDEX "flag_submissions_user_id_challenge_id_submitted_at_idx" ON "flag_submissions"("user_id", "challenge_id", "submitted_at");

-- CreateIndex
CREATE INDEX "flag_submissions_attempt_id_submitted_at_idx" ON "flag_submissions"("attempt_id", "submitted_at");

-- CreateIndex
CREATE INDEX "challenge_solves_user_id_solved_at_idx" ON "challenge_solves"("user_id", "solved_at");

-- CreateIndex
CREATE INDEX "challenge_solves_challenge_id_solved_at_idx" ON "challenge_solves"("challenge_id", "solved_at");

-- CreateIndex
CREATE UNIQUE INDEX "challenge_solves_user_id_challenge_id_key" ON "challenge_solves"("user_id", "challenge_id");

-- AddForeignKey
ALTER TABLE "challenges" ADD CONSTRAINT "challenges_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "challenge_secrets" ADD CONSTRAINT "challenge_secrets_challenge_id_fkey" FOREIGN KEY ("challenge_id") REFERENCES "challenges"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "challenge_attempts" ADD CONSTRAINT "challenge_attempts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "challenge_attempts" ADD CONSTRAINT "challenge_attempts_challenge_id_fkey" FOREIGN KEY ("challenge_id") REFERENCES "challenges"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flag_submissions" ADD CONSTRAINT "flag_submissions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flag_submissions" ADD CONSTRAINT "flag_submissions_challenge_id_fkey" FOREIGN KEY ("challenge_id") REFERENCES "challenges"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flag_submissions" ADD CONSTRAINT "flag_submissions_attempt_id_user_id_challenge_id_fkey" FOREIGN KEY ("attempt_id", "user_id", "challenge_id") REFERENCES "challenge_attempts"("id", "user_id", "challenge_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "challenge_solves" ADD CONSTRAINT "challenge_solves_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "challenge_solves" ADD CONSTRAINT "challenge_solves_challenge_id_fkey" FOREIGN KEY ("challenge_id") REFERENCES "challenges"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
