-- CreateEnum
CREATE TYPE "user_status" AS ENUM ('INVITED', 'ACTIVE', 'SUSPENDED', 'DISABLED');

-- CreateEnum
CREATE TYPE "employee_status" AS ENUM ('PENDING', 'ACTIVE', 'SUSPENDED', 'TERMINATED');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" VARCHAR(320) NOT NULL,
    "password_hash" VARCHAR(255),
    "email_verified_at" TIMESTAMPTZ(3),
    "status" "user_status" NOT NULL DEFAULT 'INVITED',
    "failed_login_attempts" INTEGER NOT NULL DEFAULT 0,
    "locked_until" TIMESTAMPTZ(3),
    "last_login_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employees" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "employee_code" VARCHAR(40),
    "first_name" VARCHAR(120) NOT NULL,
    "last_name" VARCHAR(120) NOT NULL,
    "phone" VARCHAR(32),
    "status" "employee_status" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "employees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_facilities" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "facility_id" UUID NOT NULL,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "employee_facilities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_sessions" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "token_hash" VARCHAR(255) NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "revoked_at" TIMESTAMPTZ(3),
    "last_seen_at" TIMESTAMPTZ(3),
    "ip_address" VARCHAR(64),
    "user_agent" VARCHAR(512),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_sessions_pkey" PRIMARY KEY ("id")
);

-- AddCheckConstraints
ALTER TABLE "users"
    ADD CONSTRAINT "users_email_non_empty" CHECK (length(btrim("email")) > 0);
ALTER TABLE "users"
    ADD CONSTRAINT "users_email_trimmed" CHECK ("email" = btrim("email"));
ALTER TABLE "users"
    ADD CONSTRAINT "users_email_lowercase" CHECK ("email" = lower("email"));
ALTER TABLE "users"
    ADD CONSTRAINT "users_failed_login_attempts_non_negative" CHECK ("failed_login_attempts" >= 0);
ALTER TABLE "employees"
    ADD CONSTRAINT "employees_first_name_non_empty" CHECK (length(btrim("first_name")) > 0);
ALTER TABLE "employees"
    ADD CONSTRAINT "employees_last_name_non_empty" CHECK (length(btrim("last_name")) > 0);
ALTER TABLE "employees"
    ADD CONSTRAINT "employees_employee_code_normalized" CHECK (
        "employee_code" IS NULL
        OR ("employee_code" = btrim("employee_code") AND length("employee_code") > 0)
    );
ALTER TABLE "user_sessions"
    ADD CONSTRAINT "user_sessions_token_hash_non_empty" CHECK (
        "token_hash" = btrim("token_hash") AND length("token_hash") > 0
    );
ALTER TABLE "user_sessions"
    ADD CONSTRAINT "user_sessions_expires_at_after_created_at" CHECK ("expires_at" > "created_at");
ALTER TABLE "user_sessions"
    ADD CONSTRAINT "user_sessions_revoked_at_after_created_at" CHECK (
        "revoked_at" IS NULL OR "revoked_at" > "created_at"
    );

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_status_idx" ON "users"("status");

-- CreateIndex
CREATE INDEX "users_deleted_at_idx" ON "users"("deleted_at");

-- CreateIndex
CREATE INDEX "employees_organization_id_status_idx" ON "employees"("organization_id", "status");

-- CreateIndex
CREATE INDEX "employees_organization_id_deleted_at_idx" ON "employees"("organization_id", "deleted_at");

-- CreateIndex
CREATE INDEX "employees_user_id_idx" ON "employees"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "employees_organization_id_user_id_key" ON "employees"("organization_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "employees_organization_id_employee_code_key" ON "employees"("organization_id", "employee_code");

-- CreateIndex
CREATE UNIQUE INDEX "employees_organization_id_id_key" ON "employees"("organization_id", "id");

-- CreateIndex
CREATE INDEX "employee_facilities_organization_id_employee_id_idx" ON "employee_facilities"("organization_id", "employee_id");

-- CreateIndex
CREATE INDEX "employee_facilities_organization_id_facility_id_idx" ON "employee_facilities"("organization_id", "facility_id");

-- CreateIndex
CREATE UNIQUE INDEX "employee_facilities_organization_id_employee_id_facility_id_key"
    ON "employee_facilities"("organization_id", "employee_id", "facility_id");

-- CreateIndex
CREATE UNIQUE INDEX "employee_facilities_one_primary_per_employee"
    ON "employee_facilities"("organization_id", "employee_id")
    WHERE "is_primary" = true;

-- CreateIndex
CREATE UNIQUE INDEX "user_sessions_token_hash_key" ON "user_sessions"("token_hash");

-- CreateIndex
CREATE INDEX "user_sessions_organization_id_employee_id_idx" ON "user_sessions"("organization_id", "employee_id");

-- CreateIndex
CREATE INDEX "user_sessions_expires_at_idx" ON "user_sessions"("expires_at");

-- CreateIndex
CREATE INDEX "user_sessions_revoked_at_idx" ON "user_sessions"("revoked_at");

-- CreateIndex
CREATE UNIQUE INDEX "facilities_organization_id_id_key" ON "facilities"("organization_id", "id");

-- AddForeignKey
ALTER TABLE "employees"
    ADD CONSTRAINT "employees_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees"
    ADD CONSTRAINT "employees_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_facilities"
    ADD CONSTRAINT "employee_facilities_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_facilities"
    ADD CONSTRAINT "employee_facilities_organization_id_employee_id_fkey"
    FOREIGN KEY ("organization_id", "employee_id") REFERENCES "employees"("organization_id", "id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_facilities"
    ADD CONSTRAINT "employee_facilities_organization_id_facility_id_fkey"
    FOREIGN KEY ("organization_id", "facility_id") REFERENCES "facilities"("organization_id", "id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_sessions"
    ADD CONSTRAINT "user_sessions_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_sessions"
    ADD CONSTRAINT "user_sessions_organization_id_employee_id_fkey"
    FOREIGN KEY ("organization_id", "employee_id") REFERENCES "employees"("organization_id", "id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
