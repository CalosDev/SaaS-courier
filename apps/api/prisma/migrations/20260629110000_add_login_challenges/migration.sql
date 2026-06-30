CREATE TABLE "login_challenges" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token_hash" VARCHAR(64) NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "consumed_at" TIMESTAMPTZ(3),
    "invalidated_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "login_challenges_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "login_challenges_token_hash_lower_hex_check"
      CHECK ("token_hash" ~ '^[0-9a-f]{64}$'),
    CONSTRAINT "login_challenges_expires_at_after_created_at"
      CHECK ("expires_at" > "created_at"),
    CONSTRAINT "login_challenges_consumed_at_after_created_at"
      CHECK ("consumed_at" IS NULL OR "consumed_at" > "created_at"),
    CONSTRAINT "login_challenges_invalidated_at_after_created_at"
      CHECK ("invalidated_at" IS NULL OR "invalidated_at" > "created_at"),
    CONSTRAINT "login_challenges_not_consumed_and_invalidated"
      CHECK (
        NOT ("consumed_at" IS NOT NULL AND "invalidated_at" IS NOT NULL)
      )
);

CREATE UNIQUE INDEX "login_challenges_token_hash_key"
ON "login_challenges" ("token_hash");

CREATE UNIQUE INDEX "login_challenges_one_pending_per_user"
ON "login_challenges" ("user_id")
WHERE "consumed_at" IS NULL
  AND "invalidated_at" IS NULL;

CREATE INDEX "login_challenges_user_id_expires_at_idx"
ON "login_challenges" ("user_id", "expires_at");

CREATE INDEX "login_challenges_consumed_at_idx"
ON "login_challenges" ("consumed_at");

CREATE INDEX "login_challenges_invalidated_at_idx"
ON "login_challenges" ("invalidated_at");

ALTER TABLE "login_challenges"
ADD CONSTRAINT "login_challenges_user_id_fkey"
FOREIGN KEY ("user_id")
REFERENCES "users" ("id")
ON DELETE RESTRICT
ON UPDATE CASCADE;
