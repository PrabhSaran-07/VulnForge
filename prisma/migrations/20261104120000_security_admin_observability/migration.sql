CREATE TYPE "SecurityEventSeverity" AS ENUM ('INFO', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

ALTER TABLE "users" ADD COLUMN "is_active" BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE "security_events" (
    "id" UUID NOT NULL,
    "event_type" VARCHAR(80) NOT NULL,
    "severity" "SecurityEventSeverity" NOT NULL,
    "actor_user_id" UUID,
    "target_user_id" UUID,
    "request_id" VARCHAR(64) NOT NULL,
    "metadata" JSONB,
    "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "security_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "security_events_occurred_at_idx" ON "security_events"("occurred_at");
CREATE INDEX "security_events_event_type_occurred_at_idx" ON "security_events"("event_type", "occurred_at");
CREATE INDEX "security_events_severity_occurred_at_idx" ON "security_events"("severity", "occurred_at");

ALTER TABLE "security_events" ADD CONSTRAINT "security_events_actor_user_id_fkey"
FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "security_events" ADD CONSTRAINT "security_events_target_user_id_fkey"
FOREIGN KEY ("target_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
