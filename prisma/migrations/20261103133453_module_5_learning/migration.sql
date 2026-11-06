-- Additive learning content and progress structures for Module 5.
ALTER TABLE "challenges" ADD COLUMN "context" TEXT,
ADD COLUMN "prerequisites" TEXT[] DEFAULT ARRAY[]::TEXT[];

CREATE TABLE "challenge_hints" (
    "id" UUID NOT NULL,
    "challenge_id" UUID NOT NULL,
    "order" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "points_penalty" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "challenge_hints_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "challenge_hints_order_positive" CHECK ("order" > 0),
    CONSTRAINT "challenge_hints_penalty_nonnegative" CHECK ("points_penalty" >= 0)
);

CREATE TABLE "challenge_hint_usages" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "challenge_id" UUID NOT NULL,
    "hint_id" UUID NOT NULL,
    "penalty_points" INTEGER NOT NULL,
    "revealed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "challenge_hint_usages_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "challenge_hint_usages_penalty_nonnegative" CHECK ("penalty_points" >= 0)
);

CREATE TABLE "challenge_explanations" (
    "challenge_id" UUID NOT NULL,
    "root_cause" TEXT NOT NULL,
    "technical_explanation" TEXT NOT NULL,
    "impact" TEXT NOT NULL,
    "conditions" TEXT NOT NULL,
    "secure_implementation" TEXT NOT NULL,
    "remediation_guidance" TEXT NOT NULL,
    "detection_ideas" TEXT NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "challenge_explanations_pkey" PRIMARY KEY ("challenge_id")
);

CREATE TABLE "challenge_quiz_questions" (
    "id" UUID NOT NULL,
    "challenge_id" UUID NOT NULL,
    "order" INTEGER NOT NULL,
    "prompt" TEXT NOT NULL,
    CONSTRAINT "challenge_quiz_questions_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "challenge_quiz_questions_order_positive" CHECK ("order" > 0)
);

CREATE TABLE "challenge_quiz_options" (
    "id" UUID NOT NULL,
    "question_id" UUID NOT NULL,
    "text" TEXT NOT NULL,
    "is_correct" BOOLEAN NOT NULL DEFAULT false,
    "explanation" TEXT,
    CONSTRAINT "challenge_quiz_options_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "challenge_quiz_attempts" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "challenge_id" UUID NOT NULL,
    "score" INTEGER NOT NULL,
    "total_questions" INTEGER NOT NULL,
    "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "challenge_quiz_attempts_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "challenge_quiz_attempts_score_valid" CHECK (
        "score" >= 0 AND "total_questions" > 0 AND "score" <= "total_questions"
    )
);

CREATE TABLE "challenge_quiz_responses" (
    "id" UUID NOT NULL,
    "attempt_id" UUID NOT NULL,
    "challenge_id" UUID NOT NULL,
    "question_id" UUID NOT NULL,
    "selected_option_id" UUID NOT NULL,
    "is_correct" BOOLEAN NOT NULL,
    CONSTRAINT "challenge_quiz_responses_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "challenge_hints_challenge_id_order_idx" ON "challenge_hints"("challenge_id", "order");
CREATE UNIQUE INDEX "challenge_hints_challenge_id_order_key" ON "challenge_hints"("challenge_id", "order");
CREATE UNIQUE INDEX "challenge_hints_id_challenge_id_key" ON "challenge_hints"("id", "challenge_id");
CREATE INDEX "challenge_hint_usages_user_id_challenge_id_revealed_at_idx" ON "challenge_hint_usages"("user_id", "challenge_id", "revealed_at");
CREATE UNIQUE INDEX "challenge_hint_usages_user_id_hint_id_key" ON "challenge_hint_usages"("user_id", "hint_id");
CREATE INDEX "challenge_quiz_questions_challenge_id_order_idx" ON "challenge_quiz_questions"("challenge_id", "order");
CREATE UNIQUE INDEX "challenge_quiz_questions_challenge_id_order_key" ON "challenge_quiz_questions"("challenge_id", "order");
CREATE UNIQUE INDEX "challenge_quiz_questions_id_challenge_id_key" ON "challenge_quiz_questions"("id", "challenge_id");
CREATE INDEX "challenge_quiz_options_question_id_idx" ON "challenge_quiz_options"("question_id");
CREATE UNIQUE INDEX "challenge_quiz_options_id_question_id_key" ON "challenge_quiz_options"("id", "question_id");
CREATE UNIQUE INDEX "challenge_quiz_options_one_correct_per_question_idx"
    ON "challenge_quiz_options"("question_id")
    WHERE "is_correct" = true;
CREATE INDEX "challenge_quiz_attempts_user_id_challenge_id_submitted_at_idx" ON "challenge_quiz_attempts"("user_id", "challenge_id", "submitted_at");
CREATE UNIQUE INDEX "challenge_quiz_attempts_id_challenge_id_key" ON "challenge_quiz_attempts"("id", "challenge_id");
CREATE INDEX "challenge_quiz_responses_question_id_idx" ON "challenge_quiz_responses"("question_id");
CREATE UNIQUE INDEX "challenge_quiz_responses_attempt_id_question_id_key" ON "challenge_quiz_responses"("attempt_id", "question_id");

ALTER TABLE "challenge_hints" ADD CONSTRAINT "challenge_hints_challenge_id_fkey"
    FOREIGN KEY ("challenge_id") REFERENCES "challenges"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "challenge_hint_usages" ADD CONSTRAINT "challenge_hint_usages_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "challenge_hint_usages" ADD CONSTRAINT "challenge_hint_usages_challenge_id_fkey"
    FOREIGN KEY ("challenge_id") REFERENCES "challenges"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "challenge_hint_usages" ADD CONSTRAINT "challenge_hint_usages_hint_id_challenge_id_fkey"
    FOREIGN KEY ("hint_id", "challenge_id") REFERENCES "challenge_hints"("id", "challenge_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "challenge_explanations" ADD CONSTRAINT "challenge_explanations_challenge_id_fkey"
    FOREIGN KEY ("challenge_id") REFERENCES "challenges"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "challenge_quiz_questions" ADD CONSTRAINT "challenge_quiz_questions_challenge_id_fkey"
    FOREIGN KEY ("challenge_id") REFERENCES "challenges"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "challenge_quiz_options" ADD CONSTRAINT "challenge_quiz_options_question_id_fkey"
    FOREIGN KEY ("question_id") REFERENCES "challenge_quiz_questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "challenge_quiz_attempts" ADD CONSTRAINT "challenge_quiz_attempts_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "challenge_quiz_attempts" ADD CONSTRAINT "challenge_quiz_attempts_challenge_id_fkey"
    FOREIGN KEY ("challenge_id") REFERENCES "challenges"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "challenge_quiz_responses" ADD CONSTRAINT "challenge_quiz_responses_attempt_id_challenge_id_fkey"
    FOREIGN KEY ("attempt_id", "challenge_id") REFERENCES "challenge_quiz_attempts"("id", "challenge_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "challenge_quiz_responses" ADD CONSTRAINT "challenge_quiz_responses_question_id_challenge_id_fkey"
    FOREIGN KEY ("question_id", "challenge_id") REFERENCES "challenge_quiz_questions"("id", "challenge_id") ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "challenge_quiz_responses" ADD CONSTRAINT "challenge_quiz_responses_selected_option_id_question_id_fkey"
    FOREIGN KEY ("selected_option_id", "question_id") REFERENCES "challenge_quiz_options"("id", "question_id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- A zero-point solve is valid when accumulated hint penalties equal or exceed the award.
ALTER TABLE "challenge_solves" DROP CONSTRAINT "challenge_solves_points_positive";
ALTER TABLE "challenge_solves" ADD CONSTRAINT "challenge_solves_points_nonnegative"
    CHECK ("points_awarded" >= 0);
