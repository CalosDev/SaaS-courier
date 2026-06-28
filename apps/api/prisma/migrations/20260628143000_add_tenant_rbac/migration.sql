-- CreateTable
CREATE TABLE "roles" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "description" VARCHAR(500),
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permissions" (
    "id" UUID NOT NULL,
    "code" VARCHAR(120) NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "description" VARCHAR(500),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_roles" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "role_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "employee_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "role_id" UUID NOT NULL,
    "permission_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("id")
);

-- AddCheckConstraints
ALTER TABLE "roles"
    ADD CONSTRAINT "roles_code_non_empty" CHECK (length(btrim("code")) > 0);
ALTER TABLE "roles"
    ADD CONSTRAINT "roles_code_trimmed" CHECK ("code" = btrim("code"));
ALTER TABLE "roles"
    ADD CONSTRAINT "roles_code_uppercase" CHECK ("code" = upper("code"));
ALTER TABLE "roles"
    ADD CONSTRAINT "roles_code_format" CHECK ("code" ~ '^[A-Z][A-Z0-9_]{1,49}$');
ALTER TABLE "roles"
    ADD CONSTRAINT "roles_name_non_empty" CHECK (length(btrim("name")) > 0);
ALTER TABLE "permissions"
    ADD CONSTRAINT "permissions_code_non_empty" CHECK (length(btrim("code")) > 0);
ALTER TABLE "permissions"
    ADD CONSTRAINT "permissions_code_trimmed" CHECK ("code" = btrim("code"));
ALTER TABLE "permissions"
    ADD CONSTRAINT "permissions_code_lowercase" CHECK ("code" = lower("code"));
ALTER TABLE "permissions"
    ADD CONSTRAINT "permissions_code_format" CHECK ("code" ~ '^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$');
ALTER TABLE "permissions"
    ADD CONSTRAINT "permissions_name_non_empty" CHECK (length(btrim("name")) > 0);

-- CreateIndex
CREATE INDEX "roles_organization_id_is_active_idx" ON "roles"("organization_id", "is_active");

-- CreateIndex
CREATE INDEX "roles_organization_id_deleted_at_idx" ON "roles"("organization_id", "deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "roles_organization_id_code_key" ON "roles"("organization_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "roles_organization_id_id_key" ON "roles"("organization_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_code_key" ON "permissions"("code");

-- CreateIndex
CREATE INDEX "permissions_is_active_idx" ON "permissions"("is_active");

-- CreateIndex
CREATE INDEX "employee_roles_organization_id_employee_id_idx" ON "employee_roles"("organization_id", "employee_id");

-- CreateIndex
CREATE INDEX "employee_roles_organization_id_role_id_idx" ON "employee_roles"("organization_id", "role_id");

-- CreateIndex
CREATE UNIQUE INDEX "employee_roles_organization_id_employee_id_role_id_key" ON "employee_roles"("organization_id", "employee_id", "role_id");

-- CreateIndex
CREATE INDEX "role_permissions_organization_id_role_id_idx" ON "role_permissions"("organization_id", "role_id");

-- CreateIndex
CREATE INDEX "role_permissions_permission_id_idx" ON "role_permissions"("permission_id");

-- CreateIndex
CREATE UNIQUE INDEX "role_permissions_organization_id_role_id_permission_id_key" ON "role_permissions"("organization_id", "role_id", "permission_id");

-- AddForeignKey
ALTER TABLE "roles" ADD CONSTRAINT "roles_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_roles" ADD CONSTRAINT "employee_roles_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_roles" ADD CONSTRAINT "employee_roles_organization_id_employee_id_fkey" FOREIGN KEY ("organization_id", "employee_id") REFERENCES "employees"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_roles" ADD CONSTRAINT "employee_roles_organization_id_role_id_fkey" FOREIGN KEY ("organization_id", "role_id") REFERENCES "roles"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_organization_id_role_id_fkey" FOREIGN KEY ("organization_id", "role_id") REFERENCES "roles"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

