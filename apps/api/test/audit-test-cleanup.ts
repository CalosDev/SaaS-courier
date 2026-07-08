import { PrismaService } from '../src/prisma/prisma.service';

export async function deleteAuditArtifactsForOrganizations(
  prisma: PrismaService,
  organizationIds: string[],
): Promise<void> {
  if (organizationIds.length === 0) {
    return;
  }

  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe("SET LOCAL app.audit_mutation_bypass = 'on'");
    await tx.auditLog.deleteMany({
      where: { organizationId: { in: organizationIds } },
    });
    await tx.outboxEvent.deleteMany({
      where: { organizationId: { in: organizationIds } },
    });
  });
}

export async function deleteInventoryArtifactsForOrganizations(
  prisma: PrismaService,
  organizationIds: string[],
): Promise<void> {
  if (organizationIds.length === 0) {
    return;
  }

  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(
      'ALTER TABLE "inventory_movements" DISABLE TRIGGER "inventory_movements_immutable"',
    );
    await tx.inventoryMovement.deleteMany({
      where: { organizationId: { in: organizationIds } },
    });
    await tx.$executeRawUnsafe(
      'ALTER TABLE "inventory_movements" ENABLE TRIGGER "inventory_movements_immutable"',
    );
    await tx.packageInventoryPosition.deleteMany({
      where: { organizationId: { in: organizationIds } },
    });
    await tx.warehouseLocation.deleteMany({
      where: { organizationId: { in: organizationIds } },
    });
  });
}
