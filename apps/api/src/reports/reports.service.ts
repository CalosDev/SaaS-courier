import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface DashboardMetrics {
  pendingPackages: number;
  unmatchedPrealerts: number;
  activeShipments: number;
}

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async getDashboardMetrics(organizationId: string): Promise<DashboardMetrics> {
    const [pendingPackages, unmatchedPrealerts, activeShipments] =
      await Promise.all([
        this.prisma.package.count({
          where: {
            organizationId,
            status: {
              in: [
                'RECEPTION_PENDING',
                'RECEIVED_AT_ORIGIN',
                'IN_TRANSIT',
                'ARRIVED_AT_DESTINATION',
              ],
            },
          },
        }),
        this.prisma.prealert.count({
          where: {
            organizationId,
            status: 'PENDING_ARRIVAL',
          },
        }),
        this.prisma.houseShipment.count({
          where: {
            organizationId,
            status: { not: 'CLOSED' },
          },
        }),
      ]);

    return {
      pendingPackages,
      unmatchedPrealerts,
      activeShipments,
    };
  }

  async getPackagesExportCsv(organizationId: string): Promise<string> {
    const packages = await this.prisma.package.findMany({
      where: { organizationId },
      include: { customer: true },
      orderBy: { createdAt: 'desc' },
      take: 1000,
    });

    const headers = [
      'ID',
      'Tracking Interno',
      'Tracking Externo',
      'Cliente',
      'Estado',
      'Fecha Registro',
    ];
    const rows = packages.map((pkg) => [
      pkg.id,
      pkg.internalTrackingNumber,
      pkg.externalTrackingNumber || 'N/A',
      pkg.customer
        ? `${pkg.customer.firstName} ${pkg.customer.lastName}`
        : 'Desconocido',
      pkg.status,
      pkg.createdAt.toISOString(),
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map((row) =>
        row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','),
      ),
    ].join('\n');

    return csvContent;
  }
}
