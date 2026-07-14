import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';

import { PrismaAuditOutboxWriter } from '../audit/prisma-audit-outbox.writer';
import { PrismaService } from '../prisma/prisma.service';
import type { CommandContext } from '../request-context/request-context.types';
import type {
  ReportTypeValue,
  CreateReportExportDto,
} from './dto/create-report-export.dto';
import type { ReportFilterDto } from './dto/report-filter.dto';

const MAX_REPORT_RANGE_MS = 93 * 24 * 60 * 60 * 1000;
const MAX_EXPORT_ROWS = 5000;
const EXPORT_TTL_MS = 24 * 60 * 60 * 1000;

export interface DashboardMetrics {
  pendingPackages: number;
  unmatchedPrealerts: number;
  activeShipments: number;
}

type NormalizedFilters = { dateFrom?: string; dateTo?: string };
type ExportData = { headers: string[]; rows: unknown[][]; truncated: boolean };

export function escapeCsvCell(value: unknown): string {
  let normalized =
    value === null || value === undefined
      ? ''
      : typeof value === 'string'
        ? value
        : typeof value === 'number' ||
            typeof value === 'boolean' ||
            typeof value === 'bigint'
          ? value.toString()
          : typeof value === 'object'
            ? JSON.stringify(value)
            : '';
  if (/^[=+\-@\t\r]/.test(normalized)) {
    normalized = `'${normalized}`;
  }
  return `"${normalized.replace(/"/g, '""')}"`;
}

@Injectable()
export class ReportsService {
  private readonly auditWriter = new PrismaAuditOutboxWriter();
  private processing = false;

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
          where: { organizationId, status: 'PENDING_ARRIVAL' },
        }),
        this.prisma.houseShipment.count({
          where: { organizationId, status: { not: 'CLOSED' } },
        }),
      ]);

    return { pendingPackages, unmatchedPrealerts, activeShipments };
  }

  async getOperationsReport(organizationId: string, input: ReportFilterDto) {
    const filters = this.normalizeFilters(input);
    const byStatus = await this.prisma.package.groupBy({
      by: ['status'],
      where: { organizationId, createdAt: this.dateWhere(filters) },
      _count: { _all: true },
      orderBy: { status: 'asc' },
    });
    return this.reportEnvelope(filters, {
      total: byStatus.reduce((sum, item) => sum + item._count._all, 0),
      byStatus: byStatus.map((item) => ({
        status: item.status,
        count: item._count._all,
      })),
    });
  }

  async getInventoryReport(organizationId: string, input: ReportFilterDto) {
    const filters = this.normalizeFilters(input);
    const [positions, movements] = await Promise.all([
      this.prisma.packageInventoryPosition.count({ where: { organizationId } }),
      this.prisma.inventoryMovement.groupBy({
        by: ['movementType'],
        where: { organizationId, occurredAt: this.dateWhere(filters) },
        _count: { _all: true },
        orderBy: { movementType: 'asc' },
      }),
    ]);
    return this.reportEnvelope(filters, {
      currentPositions: positions,
      movements: movements.map((item) => ({
        type: item.movementType,
        count: item._count._all,
      })),
    });
  }

  async getBillingReport(organizationId: string, input: ReportFilterDto) {
    const filters = this.normalizeFilters(input);
    const invoices = await this.prisma.customerInvoice.groupBy({
      by: ['status', 'currencyCode'],
      where: { organizationId, createdAt: this.dateWhere(filters) },
      _count: { _all: true },
      _sum: { totalMinor: true, balanceDueMinor: true },
      orderBy: [{ currencyCode: 'asc' }, { status: 'asc' }],
    });
    return this.reportEnvelope(filters, {
      invoices: invoices.map((item) => ({
        status: item.status,
        currencyCode: item.currencyCode,
        count: item._count._all,
        totalMinor: (item._sum.totalMinor ?? 0n).toString(),
        balanceDueMinor: (item._sum.balanceDueMinor ?? 0n).toString(),
      })),
    });
  }

  async getShipmentsReport(organizationId: string, input: ReportFilterDto) {
    const filters = this.normalizeFilters(input);
    const byStatus = await this.prisma.dispatch.groupBy({
      by: ['status'],
      where: { organizationId, createdAt: this.dateWhere(filters) },
      _count: { _all: true },
      orderBy: { status: 'asc' },
    });
    return this.reportEnvelope(filters, {
      total: byStatus.reduce((sum, item) => sum + item._count._all, 0),
      byStatus: byStatus.map((item) => ({
        status: item.status,
        count: item._count._all,
      })),
    });
  }

  async getCustomsReport(organizationId: string, input: ReportFilterDto) {
    const filters = this.normalizeFilters(input);
    const byStatus = await this.prisma.customsCase.groupBy({
      by: ['status'],
      where: { organizationId, createdAt: this.dateWhere(filters) },
      _count: { _all: true },
      orderBy: { status: 'asc' },
    });
    return this.reportEnvelope(filters, {
      total: byStatus.reduce((sum, item) => sum + item._count._all, 0),
      byStatus: byStatus.map((item) => ({
        status: item.status,
        count: item._count._all,
      })),
    });
  }

  async requestExport(
    context: CommandContext,
    input: CreateReportExportDto,
    rawIdempotencyKey?: string,
  ) {
    if (!context.actorEmployeeId) {
      throw new BadRequestException('Employee context is required');
    }
    const requestedByEmployeeId = context.actorEmployeeId;
    const filters = this.normalizeFilters(input);
    const idempotencyKey = this.normalizeIdempotencyKey(
      rawIdempotencyKey ?? context.requestId,
    );

    const existing = await this.prisma.reportExportJob.findUnique({
      where: {
        organizationId_idempotencyKey: {
          organizationId: context.organizationId,
          idempotencyKey,
        },
      },
    });
    if (existing) return this.serializeJob(existing);

    try {
      const job = await this.prisma.$transaction(async (tx) => {
        const created = await tx.reportExportJob.create({
          data: {
            organizationId: context.organizationId,
            requestedByEmployeeId,
            reportType: input.reportType,
            filters,
            idempotencyKey,
          },
        });
        await this.auditWriter.write(tx, {
          context,
          action: 'report_export.requested',
          entityType: 'REPORT_EXPORT',
          entityId: created.id,
          changedFields: ['status', 'reportType', 'filters'],
          afterData: { status: created.status, reportType: created.reportType },
          payload: { exportId: created.id, reportType: created.reportType },
          idempotencyKey: `${context.organizationId}:report-export:${idempotencyKey}`,
          emitOutbox: true,
        });
        return created;
      });
      return this.serializeJob(job);
    } catch (error) {
      if (this.isUniqueConflict(error)) {
        const raced = await this.prisma.reportExportJob.findUnique({
          where: {
            organizationId_idempotencyKey: {
              organizationId: context.organizationId,
              idempotencyKey,
            },
          },
        });
        if (raced) return this.serializeJob(raced);
      }
      throw error;
    }
  }

  async getExport(organizationId: string, exportId: string) {
    const job = await this.findTenantJob(organizationId, exportId);
    return this.serializeJob(await this.expireIfNeeded(job));
  }

  async downloadExport(context: CommandContext, exportId: string) {
    const job = await this.expireIfNeeded(
      await this.findTenantJob(context.organizationId, exportId),
    );
    if (job.status !== 'COMPLETED' || !job.content || !job.fileName) {
      throw new ConflictException(
        'Report export is not available for download',
      );
    }
    await this.prisma.$transaction((tx) =>
      this.auditWriter.write(tx, {
        context,
        action: 'report_export.downloaded',
        entityType: 'REPORT_EXPORT',
        entityId: job.id,
        changedFields: [],
        metadata: { reportType: job.reportType },
        payload: { exportId: job.id, reportType: job.reportType },
        emitOutbox: false,
      }),
    );
    return { fileName: job.fileName, content: job.content };
  }

  async processPendingExports(): Promise<void> {
    if (this.processing) return;
    this.processing = true;
    try {
      await this.prisma.reportExportJob.updateMany({
        where: {
          status: 'COMPLETED',
          expiresAt: { lte: new Date() },
        },
        data: { status: 'EXPIRED', content: null },
      });
      const pending = await this.prisma.reportExportJob.findMany({
        where: { status: 'PENDING' },
        orderBy: { createdAt: 'asc' },
        take: 5,
        select: { id: true },
      });
      for (const item of pending) await this.processJob(item.id);
    } finally {
      this.processing = false;
    }
  }

  private async processJob(jobId: string): Promise<void> {
    const claimed = await this.prisma.reportExportJob.updateMany({
      where: { id: jobId, status: 'PENDING' },
      data: { status: 'PROCESSING', startedAt: new Date(), errorCode: null },
    });
    if (claimed.count !== 1) return;

    const job = await this.prisma.reportExportJob.findUniqueOrThrow({
      where: { id: jobId },
    });
    try {
      const filters = this.normalizeFilters(job.filters as NormalizedFilters);
      const data = await this.generateExport(
        job.organizationId,
        job.reportType,
        filters,
      );
      const content = [
        data.headers.map(escapeCsvCell).join(','),
        ...data.rows.map((row) => row.map(escapeCsvCell).join(',')),
      ].join('\r\n');
      const completedAt = new Date();
      await this.prisma.$transaction(async (tx) => {
        const completed = await tx.reportExportJob.update({
          where: { id: job.id },
          data: {
            status: 'COMPLETED',
            fileName: `${job.reportType.toLowerCase()}-${job.id}.csv`,
            contentType: 'text/csv; charset=utf-8',
            content,
            rowCount: data.rows.length,
            truncated: data.truncated,
            completedAt,
            expiresAt: new Date(completedAt.getTime() + EXPORT_TTL_MS),
          },
        });
        await this.auditWriter.write(tx, {
          context: this.systemContext(job.organizationId),
          action: 'report_export.completed',
          entityType: 'REPORT_EXPORT',
          entityId: job.id,
          changedFields: ['status', 'rowCount', 'expiresAt'],
          afterData: {
            status: completed.status,
            rowCount: completed.rowCount,
            truncated: completed.truncated,
          },
          payload: { exportId: job.id, reportType: job.reportType },
          emitOutbox: false,
        });
      });
    } catch (error) {
      await this.prisma.reportExportJob.update({
        where: { id: job.id },
        data: {
          status: 'FAILED',
          errorCode: error instanceof Error ? error.name : 'EXPORT_FAILED',
        },
      });
    }
  }

  private async generateExport(
    organizationId: string,
    reportType: ReportTypeValue,
    filters: NormalizedFilters,
  ): Promise<ExportData> {
    const take = MAX_EXPORT_ROWS + 1;
    const createdAt = this.dateWhere(filters);
    let headers: string[];
    let rows: unknown[][];

    switch (reportType) {
      case 'OPERATIONS': {
        const records = await this.prisma.package.findMany({
          where: { organizationId, createdAt },
          orderBy: { createdAt: 'desc' },
          take,
          select: {
            internalTrackingNumber: true,
            externalTrackingNumber: true,
            status: true,
            createdAt: true,
          },
        });
        headers = ['Tracking interno', 'Tracking externo', 'Estado', 'Fecha'];
        rows = records.map((item) => [
          item.internalTrackingNumber,
          item.externalTrackingNumber,
          item.status,
          item.createdAt.toISOString(),
        ]);
        break;
      }
      case 'INVENTORY': {
        const records = await this.prisma.inventoryMovement.findMany({
          where: { organizationId, occurredAt: createdAt },
          orderBy: { occurredAt: 'desc' },
          take,
          select: {
            movementType: true,
            occurredAt: true,
            package: { select: { internalTrackingNumber: true } },
            facility: { select: { code: true } },
            fromLocation: { select: { code: true } },
            toLocation: { select: { code: true } },
          },
        });
        headers = [
          'Tracking',
          'Tipo',
          'Facility',
          'Origen',
          'Destino',
          'Fecha',
        ];
        rows = records.map((item) => [
          item.package.internalTrackingNumber,
          item.movementType,
          item.facility.code,
          item.fromLocation?.code,
          item.toLocation?.code,
          item.occurredAt.toISOString(),
        ]);
        break;
      }
      case 'BILLING': {
        const records = await this.prisma.customerInvoice.findMany({
          where: { organizationId, createdAt },
          orderBy: { createdAt: 'desc' },
          take,
          select: {
            invoiceNumber: true,
            status: true,
            currencyCode: true,
            totalMinor: true,
            balanceDueMinor: true,
            createdAt: true,
          },
        });
        headers = [
          'Factura',
          'Estado',
          'Moneda',
          'Total menor',
          'Balance menor',
          'Fecha',
        ];
        rows = records.map((item) => [
          item.invoiceNumber,
          item.status,
          item.currencyCode,
          item.totalMinor.toString(),
          item.balanceDueMinor.toString(),
          item.createdAt.toISOString(),
        ]);
        break;
      }
      case 'SHIPMENTS': {
        const records = await this.prisma.dispatch.findMany({
          where: { organizationId, createdAt },
          orderBy: { createdAt: 'desc' },
          take,
          select: {
            dispatchCode: true,
            status: true,
            transportMode: true,
            departureTime: true,
            estimatedArrivalTime: true,
            createdAt: true,
          },
        });
        headers = [
          'Embarque',
          'Estado',
          'Modo',
          'Salida',
          'Llegada estimada',
          'Fecha',
        ];
        rows = records.map((item) => [
          item.dispatchCode,
          item.status,
          item.transportMode,
          item.departureTime?.toISOString(),
          item.estimatedArrivalTime?.toISOString(),
          item.createdAt.toISOString(),
        ]);
        break;
      }
      case 'CUSTOMS': {
        const records = await this.prisma.customsCase.findMany({
          where: { organizationId, createdAt },
          orderBy: { createdAt: 'desc' },
          take,
          select: { caseNumber: true, status: true, createdAt: true },
        });
        headers = ['Caso', 'Estado', 'Fecha'];
        rows = records.map((item) => [
          item.caseNumber,
          item.status,
          item.createdAt.toISOString(),
        ]);
        break;
      }
    }

    return {
      headers,
      rows: rows.slice(0, MAX_EXPORT_ROWS),
      truncated: rows.length > MAX_EXPORT_ROWS,
    };
  }

  private normalizeFilters(input: ReportFilterDto | NormalizedFilters) {
    const dateFrom = input.dateFrom ? new Date(input.dateFrom) : undefined;
    const dateTo = input.dateTo ? new Date(input.dateTo) : undefined;
    if (
      (dateFrom && Number.isNaN(dateFrom.getTime())) ||
      (dateTo && Number.isNaN(dateTo.getTime()))
    ) {
      throw new BadRequestException('Invalid report date filter');
    }
    if (dateFrom && dateTo) {
      if (dateFrom > dateTo) {
        throw new BadRequestException('dateFrom must not be after dateTo');
      }
      if (dateTo.getTime() - dateFrom.getTime() > MAX_REPORT_RANGE_MS) {
        throw new BadRequestException(
          'Report date range cannot exceed 93 days',
        );
      }
    }
    return {
      ...(dateFrom ? { dateFrom: dateFrom.toISOString() } : {}),
      ...(dateTo ? { dateTo: dateTo.toISOString() } : {}),
    };
  }

  private dateWhere(filters: NormalizedFilters) {
    if (!filters.dateFrom && !filters.dateTo) return undefined;
    return {
      ...(filters.dateFrom ? { gte: new Date(filters.dateFrom) } : {}),
      ...(filters.dateTo ? { lte: new Date(filters.dateTo) } : {}),
    };
  }

  private reportEnvelope<T extends object>(
    filters: NormalizedFilters,
    data: T,
  ) {
    return { generatedAt: new Date().toISOString(), filters, data };
  }

  private normalizeIdempotencyKey(value: string) {
    const normalized = value.trim();
    if (!/^[A-Za-z0-9._:-]{1,120}$/.test(normalized)) {
      throw new BadRequestException('Invalid Idempotency-Key');
    }
    return normalized;
  }

  private async findTenantJob(organizationId: string, exportId: string) {
    const job = await this.prisma.reportExportJob.findUnique({
      where: { organizationId_id: { organizationId, id: exportId } },
    });
    if (!job) throw new NotFoundException('Report export not found');
    return job;
  }

  private async expireIfNeeded(
    job: Awaited<ReturnType<ReportsService['findTenantJob']>>,
  ) {
    if (
      job.status === 'COMPLETED' &&
      job.expiresAt &&
      job.expiresAt <= new Date()
    ) {
      return this.prisma.reportExportJob.update({
        where: { id: job.id },
        data: { status: 'EXPIRED', content: null },
      });
    }
    return job;
  }

  private serializeJob(
    job: Awaited<ReturnType<ReportsService['findTenantJob']>>,
  ) {
    return { ...job, content: undefined };
  }

  private systemContext(organizationId: string): CommandContext {
    return {
      organizationId,
      actorType: 'SYSTEM',
      actorUserId: null,
      actorEmployeeId: null,
      source: 'JOB',
      requestId: randomUUID(),
      correlationId: `report-export-${randomUUID()}`,
      ipAddress: null,
      userAgent: null,
    };
  }

  private isUniqueConflict(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'P2002'
    );
  }
}
