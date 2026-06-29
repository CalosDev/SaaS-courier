-- AlterTable
ALTER TABLE "users"
ADD COLUMN "password_changed_at" TIMESTAMPTZ(3);

-- CreateTable
CREATE TABLE "user_activation_tokens" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token_hash" VARCHAR(64) NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "consumed_at" TIMESTAMPTZ(3),
    "invalidated_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_activation_tokens_pkey" PRIMARY KEY ("id")
);

-- AddCheckConstraints
ALTER TABLE "user_activation_tokens"
    ADD CONSTRAINT "user_activation_tokens_token_hash_sha256_hex" CHECK ("token_hash" ~ '^[a-f0-9]{64}$');
ALTER TABLE "user_activation_tokens"
    ADD CONSTRAINT "user_activation_tokens_expires_at_after_created_at" CHECK ("expires_at" > "created_at");
ALTER TABLE "user_activation_tokens"
    ADD CONSTRAINT "user_activation_tokens_consumed_at_after_created_at" CHECK (
        "consumed_at" IS NULL OR "consumed_at" > "created_at"
    );
ALTER TABLE "user_activation_tokens"
    ADD CONSTRAINT "user_activation_tokens_invalidated_at_after_created_at" CHECK (
        "invalidated_at" IS NULL OR "invalidated_at" > "created_at"
    );
ALTER TABLE "user_activation_tokens"
    ADD CONSTRAINT "user_activation_tokens_not_consumed_and_invalidated" CHECK (
        NOT ("consumed_at" IS NOT NULL AND "invalidated_at" IS NOT NULL)
    );

-- CreateIndex
CREATE UNIQUE INDEX "user_activation_tokens_token_hash_key" ON "user_activation_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "user_activation_tokens_user_id_idx" ON "user_activation_tokens"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_activation_tokens_one_pending_per_user"
ON "user_activation_tokens"("user_id")
WHERE "consumed_at" IS NULL
  AND "invalidated_at" IS NULL;

-- CreateIndex
CREATE INDEX "user_activation_tokens_expires_at_idx" ON "user_activation_tokens"("expires_at");

-- CreateIndex
CREATE INDEX "user_activation_tokens_consumed_at_idx" ON "user_activation_tokens"("consumed_at");

-- CreateIndex
CREATE INDEX "user_activation_tokens_invalidated_at_idx" ON "user_activation_tokens"("invalidated_at");

-- AddForeignKey
ALTER TABLE "user_activation_tokens"
ADD CONSTRAINT "user_activation_tokens_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
