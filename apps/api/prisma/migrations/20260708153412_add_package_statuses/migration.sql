-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "package_status" ADD VALUE 'IN_TRANSIT';
ALTER TYPE "package_status" ADD VALUE 'ARRIVED_AT_DESTINATION';
ALTER TYPE "package_status" ADD VALUE 'OUT_FOR_DELIVERY';
ALTER TYPE "package_status" ADD VALUE 'DELIVERED';
