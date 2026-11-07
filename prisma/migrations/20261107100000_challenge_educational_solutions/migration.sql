-- Add student-facing educational answers without storing or exposing CTF verifiers.
ALTER TABLE "challenge_explanations"
ADD COLUMN "expected_answer" TEXT NOT NULL DEFAULT '',
ADD COLUMN "solution_steps" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "key_takeaways" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
