import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import {
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';

import { PrismaAuditOutboxWriter } from '../audit/prisma-audit-outbox.writer';
import { ExternalTrackingNormalizer } from '../common/tracking/external-tracking-normalizer';
import { PrismaService } from '../prisma/prisma.service';
import type { CommandContext } from '../request-context/request-context.types';
import type { CarrierWebhookDto } from './dto/carrier-webhook.dto';
import type { CreateCarrierConnectionDto } from './dto/create-carrier-connection.dto';
import type { UpdateCarrierConnectionDto } from './dto/update-carrier-connection.dto';
import { CarrierSecretProvider } from './carrier-secret.provider';

const WEBHOOK_TOLERANCE_MS = 5 * 60_000;

@Injectable()
export class CarrierConnectionsService {
  private readonly auditWriter = new PrismaAuditOutboxWriter();

  constructor(
    private readonly prisma: PrismaService,
    private readonly secrets: CarrierSecretProvider,
    private readonly trackingNormalizer: ExternalTrackingNormalizer,
  ) {}

  async list(organizationId: string) {
    const rows = await this.prisma.carrierConnection.findMany({
      where: { organizationId },
      orderBy: [{ carrierCode: 'asc' }, { createdAt: 'asc' }],
    });
    return rows.map((row) => this.serialize(row));
  }

  async create(context: CommandContext, input: CreateCarrierConnectionDto) {
    const actorEmployeeId = this.actor(context);
    try {
      const created = await this.prisma.$transaction(async (tx) => {
        const row = await tx.carrierConnection.create({
          data: {
            organizationId: context.organizationId,
            createdByEmployeeId: actorEmployeeId,
            updatedByEmployeeId: actorEmployeeId,
            carrierCode: input.carrierCode,
            displayName: input.displayName.trim(),
            connectionKey: randomBytes(24).toString('base64url'),
            secretReference: input.secretReference,
            status: input.status ?? 'DISABLED',
          },
        });
        await this.auditWriter.write(tx, {
          context,
          action: 'carrier_connection.created',
          entityType: 'CARRIER_CONNECTION',
          entityId: row.id,
          changedFields: ['carrierCode', 'displayName', 'status'],
          afterData: { carrierCode: row.carrierCode, status: row.status },
          payload: { connectionId: row.id, carrierCode: row.carrierCode },
          emitOutbox: false,
        });
        return row;
      });
      return this.serialize(created);
    } catch (error) {
      if (this.isUniqueConflict(error)) {
        throw new ConflictException('Carrier connection already exists');
      }
      throw error;
    }
  }

  async update(
    context: CommandContext,
    connectionId: string,
    input: UpdateCarrierConnectionDto,
  ) {
    const actorEmployeeId = this.actor(context);
    if (!Object.keys(input).length) {
      throw new BadRequestException(
        'At least one connection field is required',
      );
    }
    const current = await this.findTenantConnection(
      context.organizationId,
      connectionId,
    );
    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.carrierConnection.update({
        where: { id: current.id },
        data: {
          ...(input.displayName !== undefined
            ? { displayName: input.displayName.trim() }
            : {}),
          ...(input.secretReference !== undefined
            ? { secretReference: input.secretReference }
            : {}),
          ...(input.status !== undefined ? { status: input.status } : {}),
          updatedByEmployeeId: actorEmployeeId,
        },
      });
      await this.auditWriter.write(tx, {
        context,
        action: 'carrier_connection.updated',
        entityType: 'CARRIER_CONNECTION',
        entityId: row.id,
        changedFields: Object.keys(input),
        beforeData: {
          displayName: current.displayName,
          status: current.status,
        },
        afterData: { displayName: row.displayName, status: row.status },
        payload: { connectionId: row.id, carrierCode: row.carrierCode },
        emitOutbox: false,
      });
      return row;
    });
    return this.serialize(updated);
  }

  async test(context: CommandContext, connectionId: string) {
    const current = await this.findTenantConnection(
      context.organizationId,
      connectionId,
    );
    const secret = this.secrets.getSecret(current.secretReference);
    let success = Boolean(secret);
    let errorCode: string | null = secret
      ? null
      : 'CARRIER_SECRET_NOT_CONFIGURED';
    const baseUrl = this.secrets.getBaseUrl(current.carrierCode);
    if (success && baseUrl) {
      try {
        const response = await fetch(`${baseUrl}/health`, {
          headers: { Authorization: `Bearer ${secret}` },
          signal: AbortSignal.timeout(5000),
        });
        success = response.ok;
        errorCode = response.ok ? null : `CARRIER_HTTP_${response.status}`;
      } catch {
        success = false;
        errorCode = 'CARRIER_CONNECTION_FAILED';
      }
    }
    const testedAt = new Date();
    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.carrierConnection.update({
        where: { id: current.id },
        data: {
          status: success ? 'ACTIVE' : 'ERROR',
          lastTestedAt: testedAt,
          lastErrorCode: errorCode,
        },
      });
      await this.auditWriter.write(tx, {
        context,
        action: 'carrier_connection.tested',
        entityType: 'CARRIER_CONNECTION',
        entityId: row.id,
        changedFields: ['status', 'lastTestedAt', 'lastErrorCode'],
        beforeData: { status: current.status },
        afterData: { status: row.status, success, errorCode },
        payload: {
          connectionId: row.id,
          carrierCode: row.carrierCode,
          success,
        },
        emitOutbox: false,
      });
      return row;
    });
    return { ...this.serialize(updated), test: { success, errorCode } };
  }

  async listPackageEvents(organizationId: string, packageId: string) {
    const packageExists = await this.prisma.package.findUnique({
      where: { organizationId_id: { organizationId, id: packageId } },
      select: { id: true },
    });
    if (!packageExists) throw new NotFoundException('Package not found');
    const rows = await this.prisma.carrierTrackingSnapshot.findMany({
      where: { organizationId, packageId },
      include: {
        connection: { select: { carrierCode: true, displayName: true } },
      },
      orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
    });
    return {
      items: rows.map((row) => ({
        id: row.id,
        carrier: row.connection,
        status: row.status,
        occurredAt: row.occurredAt.toISOString(),
        location: row.location,
        description: row.description,
      })),
    };
  }

  async receiveWebhook(input: {
    connectionKey: string;
    eventId: string;
    timestamp: string;
    signature: string;
    body: CarrierWebhookDto;
  }) {
    const connection = await this.prisma.carrierConnection.findUnique({
      where: { connectionKey: input.connectionKey },
    });
    if (!connection || connection.status !== 'ACTIVE') {
      throw new NotFoundException('Carrier connection not found');
    }
    const timestampMs = Number(input.timestamp);
    if (
      !Number.isFinite(timestampMs) ||
      Math.abs(Date.now() - timestampMs) > WEBHOOK_TOLERANCE_MS
    ) {
      throw new UnauthorizedException('Carrier webhook timestamp is invalid');
    }
    const secret = this.secrets.getSecret(connection.secretReference);
    if (!secret)
      throw new UnauthorizedException('Carrier webhook authentication failed');
    const canonicalBody = this.canonicalJson(input.body);
    const expected = createHmac('sha256', secret)
      .update(`${input.timestamp}.${canonicalBody}`)
      .digest('hex');
    const provided = input.signature.replace(/^sha256=/, '').toLowerCase();
    if (
      !/^[a-f0-9]{64}$/.test(provided) ||
      !timingSafeEqual(Buffer.from(expected), Buffer.from(provided))
    ) {
      throw new UnauthorizedException('Carrier webhook authentication failed');
    }

    const existing = await this.prisma.carrierWebhookReceipt.findUnique({
      where: {
        connectionId_providerEventId: {
          connectionId: connection.id,
          providerEventId: input.eventId,
        },
      },
    });
    if (existing) return { accepted: true, duplicate: true };

    const normalized = this.trackingNormalizer.normalize(
      input.body.trackingNumber,
    ).normalized;
    const packageRecord = await this.prisma.package.findFirst({
      where: {
        organizationId: connection.organizationId,
        externalTrackingNumberNormalized: normalized,
        deletedAt: null,
      },
      select: { id: true },
    });
    if (!packageRecord) throw new NotFoundException('Package not found');
    const payloadHash = createHash('sha256')
      .update(canonicalBody)
      .digest('hex');
    const occurredAt = new Date(input.body.occurredAt);
    if (Number.isNaN(occurredAt.getTime()))
      throw new BadRequestException('Invalid carrier event date');

    try {
      await this.prisma.$transaction(async (tx) => {
        const receipt = await tx.carrierWebhookReceipt.create({
          data: {
            organizationId: connection.organizationId,
            connectionId: connection.id,
            providerEventId: input.eventId,
            payloadHash,
            signatureHash: createHash('sha256')
              .update(input.signature)
              .digest('hex'),
            processedAt: new Date(),
          },
        });
        const snapshot = await tx.carrierTrackingSnapshot.create({
          data: {
            organizationId: connection.organizationId,
            connectionId: connection.id,
            packageId: packageRecord.id,
            webhookReceiptId: receipt.id,
            externalEventId: input.eventId,
            status: input.body.status,
            occurredAt,
            location: this.sanitize(input.body.location, 160),
            description: this.sanitize(input.body.description, 300),
            payloadHash,
          },
        });
        await tx.outboxEvent.create({
          data: {
            organizationId: connection.organizationId,
            eventType: 'carrier.tracking.updated',
            aggregateType: 'PACKAGE',
            aggregateId: packageRecord.id,
            schemaVersion: 1,
            payload: {
              packageId: packageRecord.id,
              snapshotId: snapshot.id,
              status: snapshot.status,
              carrierCode: connection.carrierCode,
            },
            idempotencyKey: `carrier:${connection.id}:${input.eventId}`,
            status: 'PENDING',
            occurredAt: new Date(),
            availableAt: new Date(),
          },
        });
      });
    } catch (error) {
      if (this.isUniqueConflict(error))
        return { accepted: true, duplicate: true };
      throw error;
    }
    return { accepted: true, duplicate: false };
  }

  private async findTenantConnection(organizationId: string, id: string) {
    const row = await this.prisma.carrierConnection.findUnique({
      where: { organizationId_id: { organizationId, id } },
    });
    if (!row) throw new NotFoundException('Carrier connection not found');
    return row;
  }

  private serialize(row: {
    id: string;
    carrierCode: string;
    displayName: string;
    connectionKey: string;
    secretReference: string;
    status: string;
    lastTestedAt: Date | null;
    lastErrorCode: string | null;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: row.id,
      carrierCode: row.carrierCode,
      displayName: row.displayName,
      connectionKey: row.connectionKey,
      status: row.status,
      credentialConfigured: Boolean(
        this.secrets.getSecret(row.secretReference),
      ),
      lastTestedAt: row.lastTestedAt?.toISOString() ?? null,
      lastErrorCode: row.lastErrorCode,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private actor(context: CommandContext): string {
    if (!context.actorEmployeeId)
      throw new BadRequestException('Employee context is required');
    return context.actorEmployeeId;
  }

  private canonicalJson(value: unknown): string {
    if (Array.isArray(value))
      return `[${value.map((item) => this.canonicalJson(item)).join(',')}]`;
    if (value && typeof value === 'object') {
      const entries = Object.entries(value as Record<string, unknown>)
        .filter(([, item]) => item !== undefined)
        .sort(([left], [right]) => left.localeCompare(right));
      return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${this.canonicalJson(item)}`).join(',')}}`;
    }
    return JSON.stringify(value);
  }

  private sanitize(value: string | undefined, max: number): string | null {
    const normalized = value
      ?.split('')
      .map((character) => {
        const code = character.charCodeAt(0);
        return code <= 31 || code === 127 ? ' ' : character;
      })
      .join('')
      .trim();
    return normalized ? normalized.slice(0, max) : null;
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
