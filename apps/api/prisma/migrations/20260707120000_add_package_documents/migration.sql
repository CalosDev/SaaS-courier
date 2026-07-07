-- CreateEnum
CREATE TYPE "package_document_type" AS ENUM ('INVOICE', 'PURCHASE_RECEIPT', 'PACKAGE_PHOTO', 'DAMAGE_PHOTO', 'IDENTITY_SUPPORT', 'OTHER');

-- CreateEnum
CREATE TYPE "stored_object_status" AS ENUM ('PENDING_UPLOAD', 'AVAILABLE', 'QUARANTINED', 'DELETED');

-- CreateTable
CREATE TABLE "stored_objects" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "created_by_employee_id" UUID NOT NULL,
    "bucket_name" VARCHAR(120) NOT NULL,
    "object_key" VARCHAR(400) NOT NULL,
    "original_filename" VARCHAR(255) NOT NULL,
    "content_type" VARCHAR(120) NOT NULL,
    "content_length" INTEGER NOT NULL,
    "status" "stored_object_status" NOT NULL DEFAULT 'PENDING_UPLOAD',
    "etag" VARCHAR(120),
    "uploaded_at" TIMESTAMPTZ(3),
    "deleted_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stored_objects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "package_documents" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "package_id" UUID NOT NULL,
    "stored_object_id" UUID NOT NULL,
    "created_by_employee_id" UUID NOT NULL,
    "deleted_by_employee_id" UUID,
    "document_type" "package_document_type" NOT NULL,
    "available_at" TIMESTAMPTZ(3),
    "deleted_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "package_documents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "stored_objects_org_status_created_at_idx" ON "stored_objects"("organization_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "stored_objects_org_deleted_at_idx" ON "stored_objects"("organization_id", "deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "stored_objects_organization_id_id_key" ON "stored_objects"("organization_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "stored_objects_org_object_key_key" ON "stored_objects"("organization_id", "object_key");

-- CreateIndex
CREATE INDEX "package_documents_org_package_deleted_created_idx" ON "package_documents"("organization_id", "package_id", "deleted_at", "created_at");

-- CreateIndex
CREATE INDEX "package_documents_org_type_deleted_idx" ON "package_documents"("organization_id", "document_type", "deleted_at");

-- CreateIndex
CREATE INDEX "package_documents_org_created_by_employee_id_idx" ON "package_documents"("organization_id", "created_by_employee_id");

-- CreateIndex
CREATE UNIQUE INDEX "package_documents_organization_id_id_key" ON "package_documents"("organization_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "package_documents_org_stored_object_id_key" ON "package_documents"("organization_id", "stored_object_id");

-- AddForeignKey
ALTER TABLE "stored_objects" ADD CONSTRAINT "stored_objects_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stored_objects" ADD CONSTRAINT "stored_objects_organization_id_created_by_employee_id_fkey" FOREIGN KEY ("organization_id", "created_by_employee_id") REFERENCES "employees"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "package_documents" ADD CONSTRAINT "package_documents_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "package_documents" ADD CONSTRAINT "package_documents_organization_id_package_id_fkey" FOREIGN KEY ("organization_id", "package_id") REFERENCES "packages"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "package_documents" ADD CONSTRAINT "package_documents_organization_id_stored_object_id_fkey" FOREIGN KEY ("organization_id", "stored_object_id") REFERENCES "stored_objects"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "package_documents" ADD CONSTRAINT "package_documents_organization_id_created_by_employee_id_fkey" FOREIGN KEY ("organization_id", "created_by_employee_id") REFERENCES "employees"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "package_documents" ADD CONSTRAINT "package_documents_organization_id_deleted_by_employee_id_fkey" FOREIGN KEY ("organization_id", "deleted_by_employee_id") REFERENCES "employees"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
