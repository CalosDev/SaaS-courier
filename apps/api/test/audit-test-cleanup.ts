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
