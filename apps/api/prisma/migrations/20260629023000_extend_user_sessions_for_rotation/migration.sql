-- CreateEnum
CREATE TYPE "session_revocation_reason" AS ENUM (
    'LOGOUT',
    'ROTATED',
    'REUSE_DETECTED',
    'IDLE_TIMEOUT',
    'ADMIN_REVOKED',
    'ACCOUNT_CHANGED'
);

-- AlterTable
ALTER TABLE "user_sessions"
    ADD COLUMN "family_id" UUID,
    ADD COLUMN "revocation_reason" "session_revocation_reason",
    ADD COLUMN "rotated_from_session_id" UUID;

-- Backfill existing rows safely
UPDATE "user_sessions"
SET "family_id" = "id"
WHERE "family_id" IS NULL;

UPDATE "user_sessions"
SET "revocation_reason" = 'ADMIN_REVOKED'::"session_revocation_reason"
WHERE "revoked_at" IS NOT NULL
  AND "revocation_reason" IS NULL;

ALTER TABLE "user_sessions"
    ALTER COLUMN "family_id" SET NOT NULL;

-- AddCheckConstraints
ALTER TABLE "user_sessions"
    ADD CONSTRAINT "user_sessions_revocation_state_consistent" CHECK (
        (
            "revoked_at" IS NULL
            AND "revocation_reason" IS NULL
        )
        OR (
            "revoked_at" IS NOT NULL
            AND "revocation_reason" IS NOT NULL
        )
    );

ALTER TABLE "user_sessions"
    ADD CONSTRAINT "user_sessions_not_self_rotated" CHECK (
        "rotated_from_session_id" IS NULL
        OR "rotated_from_session_id" <> "id"
    );

-- CreateIndex
CREATE UNIQUE INDEX "user_sessions_family_id_id_key"
    ON "user_sessions"("family_id", "id");

CREATE UNIQUE INDEX "user_sessions_rotated_from_session_id_key"
    ON "user_sessions"("rotated_from_session_id");

CREATE UNIQUE INDEX "user_sessions_one_active_per_family"
    ON "user_sessions"("family_id")
    WHERE "revoked_at" IS NULL;

CREATE INDEX "user_sessions_family_id_revoked_at_idx"
    ON "user_sessions"("family_id", "revoked_at");

CREATE INDEX "user_sessions_organization_id_employee_id_revoked_at_expires_at_idx"
    ON "user_sessions"("organization_id", "employee_id", "revoked_at", "expires_at");

-- AddForeignKey
ALTER TABLE "user_sessions"
    ADD CONSTRAINT "user_sessions_family_id_rotated_from_session_id_fkey"
    FOREIGN KEY ("family_id", "rotated_from_session_id")
    REFERENCES "user_sessions"("family_id", "id")
    ON DELETE RESTRICT
    ON UPDATE CASCADE;
