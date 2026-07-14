import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaAuditOutboxWriter } from '../audit/prisma-audit-outbox.writer';
import { PrismaService } from '../prisma/prisma.service';
import type { CommandContext } from '../request-context/request-context.types';
import type { CreateNotificationTemplateDto } from './dto/create-notification-template.dto';
import { NOTIFICATION_VARIABLES } from './dto/create-notification-template.dto';
import type { ListNotificationDeliveriesDto } from './dto/list-notification-deliveries.dto';
import type { UpdateNotificationTemplateDto } from './dto/update-notification-template.dto';
import { SmtpEmailSender } from './smtp-email.sender';

const PLACEHOLDER_PATTERN = /{{\s*([A-Za-z][A-Za-z0-9]*)\s*}}/g;
const MAX_ATTEMPTS = 3;

@Injectable()
export class NotificationsService {
  private readonly auditWriter = new PrismaAuditOutboxWriter();
  private processing = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailSender: SmtpEmailSender,
  ) {}

  async listTemplates(organizationId: string) {
    return this.prisma.notificationTemplate.findMany({
      where: { organizationId },
      orderBy: [{ code: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async createTemplate(
    context: CommandContext,
    input: CreateNotificationTemplateDto,
  ) {
    const actorEmployeeId = this.actor(context);
    const allowedVariables = this.validateTemplate(input);
    return this.prisma.$transaction(async (tx) => {
      const created = await tx.notificationTemplate.create({
        data: {
          organizationId: context.organizationId,
          createdByEmployeeId: actorEmployeeId,
          updatedByEmployeeId: actorEmployeeId,
          code: input.code.trim().toUpperCase(),
          eventType: input.eventType.trim(),
          subjectTemplate: input.subjectTemplate.trim(),
          bodyTemplate: input.bodyTemplate.trim(),
          allowedVariables,
          isActive: input.isActive ?? true,
        },
      });
      await this.auditWriter.write(tx, {
        context,
        action: 'notification_template.created',
        entityType: 'NOTIFICATION_TEMPLATE',
        entityId: created.id,
        changedFields: ['code', 'eventType', 'isActive'],
        afterData: {
          code: created.code,
          eventType: created.eventType,
          isActive: created.isActive,
        },
        payload: { templateId: created.id, eventType: created.eventType },
        emitOutbox: false,
      });
      return created;
    });
  }

  async updateTemplate(
    context: CommandContext,
    templateId: string,
    input: UpdateNotificationTemplateDto,
  ) {
    const actorEmployeeId = this.actor(context);
    const current = await this.findTemplate(context.organizationId, templateId);
    if (Object.keys(input).length === 0) {
      throw new BadRequestException('At least one template field is required');
    }
    const merged = {
      eventType: input.eventType ?? current.eventType,
      subjectTemplate: input.subjectTemplate ?? current.subjectTemplate,
      bodyTemplate: input.bodyTemplate ?? current.bodyTemplate,
      allowedVariables:
        input.allowedVariables ?? (current.allowedVariables as string[]),
      isActive: input.isActive ?? current.isActive,
    };
    const allowedVariables = this.validateTemplate(merged);
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.notificationTemplate.update({
        where: { id: current.id },
        data: {
          eventType: merged.eventType.trim(),
          subjectTemplate: merged.subjectTemplate.trim(),
          bodyTemplate: merged.bodyTemplate.trim(),
          allowedVariables,
          isActive: merged.isActive,
          updatedByEmployeeId: actorEmployeeId,
        },
      });
      await this.auditWriter.write(tx, {
        context,
        action: 'notification_template.updated',
        entityType: 'NOTIFICATION_TEMPLATE',
        entityId: updated.id,
        changedFields: Object.keys(input),
        beforeData: {
          eventType: current.eventType,
          isActive: current.isActive,
        },
        afterData: { eventType: updated.eventType, isActive: updated.isActive },
        payload: { templateId: updated.id, eventType: updated.eventType },
        emitOutbox: false,
      });
      return updated;
    });
  }

  async listDeliveries(
    organizationId: string,
    input: ListNotificationDeliveriesDto,
  ) {
    const page = input.page ?? 1;
    const pageSize = input.pageSize ?? 25;
    const where = {
      organizationId,
      ...(input.status ? { status: input.status } : {}),
    };
    const [totalItems, rows] = await this.prisma.$transaction([
      this.prisma.notificationDelivery.count({ where }),
      this.prisma.notificationDelivery.findMany({
        where,
        include: { template: { select: { code: true, eventType: true } } },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    return {
      items: rows.map((row) => ({
        id: row.id,
        template: row.template,
        channel: row.channel,
        recipient: this.maskEmail(row.recipientEmail),
        subject: row.subject,
        status: row.status,
        attempts: row.attempts,
        lastErrorCode: row.lastErrorCode,
        sentAt: row.sentAt?.toISOString() ?? null,
        createdAt: row.createdAt.toISOString(),
      })),
      pagination: {
        page,
        pageSize,
        totalItems,
        totalPages: totalItems ? Math.ceil(totalItems / pageSize) : 0,
      },
    };
  }

  async retryDelivery(context: CommandContext, deliveryId: string) {
    const delivery = await this.prisma.notificationDelivery.findUnique({
      where: {
        organizationId_id: {
          organizationId: context.organizationId,
          id: deliveryId,
        },
      },
    });
    if (!delivery)
      throw new NotFoundException('Notification delivery not found');
    if (!['FAILED', 'DEAD_LETTER'].includes(delivery.status)) {
      throw new ConflictException('Only failed deliveries can be retried');
    }
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.notificationDelivery.update({
        where: { id: delivery.id },
        data: {
          status: 'PENDING',
          attempts: 0,
          availableAt: new Date(),
          lockedBy: null,
          lockedUntil: null,
          lastErrorCode: null,
        },
      });
      await this.auditWriter.write(tx, {
        context,
        action: 'notification_delivery.retried',
        entityType: 'NOTIFICATION_DELIVERY',
        entityId: delivery.id,
        changedFields: ['status', 'attempts'],
        beforeData: { status: delivery.status, attempts: delivery.attempts },
        afterData: { status: updated.status, attempts: updated.attempts },
        payload: { deliveryId: delivery.id },
        emitOutbox: false,
      });
      return { id: updated.id, status: updated.status };
    });
  }

  async consumeOutboxEvent(event: Record<string, unknown>): Promise<void> {
    const organizationId = this.eventString(event, 'organization_id');
    const eventType = this.eventString(event, 'event_type');
    const outboxEventId = this.eventString(event, 'id');
    if (!organizationId || !eventType || !outboxEventId) return;

    const templates = await this.prisma.notificationTemplate.findMany({
      where: { organizationId, eventType, isActive: true },
    });
    if (!templates.length) return;
    const recipient = await this.resolveRecipient(
      organizationId,
      this.eventString(event, 'aggregate_type'),
      this.eventString(event, 'aggregate_id'),
    );
    if (!recipient?.email) return;
    const organization = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { commercialName: true },
    });
    const payload =
      typeof event.payload === 'object' && event.payload !== null
        ? (event.payload as Record<string, unknown>)
        : {};
    const variables: Record<string, string> = {
      organizationName: organization?.commercialName ?? '',
      customerCode: recipient.customerCode,
      trackingNumber: this.safeValue(payload, [
        'internalTrackingNumber',
        'trackingNumber',
      ]),
      status: this.safeValue(payload, ['status']),
      eventType,
    };
    for (const template of templates) {
      const allowed = new Set(template.allowedVariables as string[]);
      const values = Object.fromEntries(
        Object.entries(variables).filter(([key]) => allowed.has(key)),
      );
      try {
        await this.prisma.notificationDelivery.create({
          data: {
            organizationId,
            templateId: template.id,
            outboxEventId,
            recipientEmail: recipient.email,
            subject: this.render(template.subjectTemplate, values),
            body: this.render(template.bodyTemplate, values),
          },
        });
      } catch (error) {
        if (!this.isUniqueConflict(error)) throw error;
      }
    }
  }

  async processPendingDeliveries(): Promise<void> {
    if (this.processing) return;
    this.processing = true;
    try {
      const rows = await this.prisma.notificationDelivery.findMany({
        where: {
          status: { in: ['PENDING', 'FAILED'] },
          availableAt: { lte: new Date() },
          OR: [{ lockedUntil: null }, { lockedUntil: { lt: new Date() } }],
        },
        orderBy: { createdAt: 'asc' },
        take: 10,
        select: { id: true },
      });
      for (const row of rows) await this.processDelivery(row.id);
    } finally {
      this.processing = false;
    }
  }

  private async processDelivery(id: string) {
    const lockedBy = `notification-${process.pid}`;
    const claimed = await this.prisma.notificationDelivery.updateMany({
      where: {
        id,
        status: { in: ['PENDING', 'FAILED'] },
        OR: [{ lockedUntil: null }, { lockedUntil: { lt: new Date() } }],
      },
      data: {
        status: 'PROCESSING',
        attempts: { increment: 1 },
        lockedBy,
        lockedUntil: new Date(Date.now() + 5 * 60_000),
      },
    });
    if (!claimed.count) return;
    const delivery = await this.prisma.notificationDelivery.findUniqueOrThrow({
      where: { id },
    });
    try {
      const sent = await this.emailSender.send({
        to: delivery.recipientEmail,
        subject: delivery.subject,
        body: delivery.body,
      });
      await this.prisma.notificationDelivery.updateMany({
        where: { id, lockedBy },
        data: {
          status: 'SENT',
          sentAt: new Date(),
          providerMessageId: sent.messageId.slice(0, 200),
          lockedBy: null,
          lockedUntil: null,
          lastErrorCode: null,
        },
      });
    } catch (error) {
      const dead = delivery.attempts >= MAX_ATTEMPTS;
      await this.prisma.notificationDelivery.updateMany({
        where: { id, lockedBy },
        data: {
          status: dead ? 'DEAD_LETTER' : 'FAILED',
          availableAt: new Date(Date.now() + delivery.attempts * 60_000),
          lockedBy: null,
          lockedUntil: null,
          lastErrorCode: this.errorCode(error),
        },
      });
    }
  }

  private validateTemplate(input: {
    subjectTemplate: string;
    bodyTemplate: string;
    allowedVariables: readonly string[];
  }): string[] {
    if (/\r|\n/.test(input.subjectTemplate)) {
      throw new BadRequestException(
        'Notification subject cannot contain line breaks',
      );
    }
    const allowed = [...new Set(input.allowedVariables)];
    const global = new Set<string>(NOTIFICATION_VARIABLES);
    if (allowed.some((variable) => !global.has(variable))) {
      throw new BadRequestException('Notification variable is not allowed');
    }
    const used = [input.subjectTemplate, input.bodyTemplate].flatMap(
      (template) =>
        [...template.matchAll(PLACEHOLDER_PATTERN)].map((match) => match[1]),
    );
    if (used.some((variable) => !allowed.includes(variable))) {
      throw new BadRequestException(
        'Template uses a variable outside its allowlist',
      );
    }
    return allowed;
  }

  private render(template: string, values: Record<string, string>): string {
    return template.replace(
      PLACEHOLDER_PATTERN,
      (_, variable: string) => values[variable] ?? '',
    );
  }

  private async resolveRecipient(
    organizationId: string,
    aggregateType: string | null,
    aggregateId: string | null,
  ): Promise<{ email: string; customerCode: string } | null> {
    if (!aggregateId) return null;
    const customerSelect = { email: true, customerCode: true } as const;
    if (aggregateType === 'PACKAGE') {
      const row = await this.prisma.package.findFirst({
        where: { organizationId, id: aggregateId },
        select: { customer: { select: customerSelect } },
      });
      return row?.customer.email
        ? { ...row.customer, email: row.customer.email }
        : null;
    }
    if (aggregateType === 'PREALERT') {
      const row = await this.prisma.prealert.findFirst({
        where: { organizationId, id: aggregateId },
        select: { customer: { select: customerSelect } },
      });
      return row?.customer.email
        ? { ...row.customer, email: row.customer.email }
        : null;
    }
    if (aggregateType === 'INVOICE') {
      const row = await this.prisma.customerInvoice.findFirst({
        where: { organizationId, id: aggregateId },
        select: { customer: { select: customerSelect } },
      });
      return row?.customer.email
        ? { ...row.customer, email: row.customer.email }
        : null;
    }
    if (aggregateType === 'PICKUP_REQUEST') {
      const row = await this.prisma.pickupRequest.findFirst({
        where: { organizationId, id: aggregateId },
        select: { customer: { select: customerSelect } },
      });
      return row?.customer.email
        ? { ...row.customer, email: row.customer.email }
        : null;
    }
    if (aggregateType === 'DELIVERY_ORDER') {
      const row = await this.prisma.deliveryOrder.findFirst({
        where: { organizationId, id: aggregateId },
        select: { customer: { select: customerSelect } },
      });
      return row?.customer.email
        ? { ...row.customer, email: row.customer.email }
        : null;
    }
    return null;
  }

  private findTemplate(organizationId: string, id: string) {
    return this.prisma.notificationTemplate
      .findUnique({
        where: { organizationId_id: { organizationId, id } },
      })
      .then((row) => {
        if (!row)
          throw new NotFoundException('Notification template not found');
        return row;
      });
  }

  private actor(context: CommandContext): string {
    if (!context.actorEmployeeId)
      throw new BadRequestException('Employee context is required');
    return context.actorEmployeeId;
  }

  private maskEmail(value: string): string {
    const [local, domain] = value.split('@');
    return `${local.slice(0, 1)}***@${domain}`;
  }

  private eventString(
    event: Record<string, unknown>,
    key: string,
  ): string | null {
    const value = event[key];
    return typeof value === 'string' && value.trim() ? value.trim() : null;
  }

  private safeValue(payload: Record<string, unknown>, keys: string[]): string {
    for (const key of keys) {
      const value = payload[key];
      if (typeof value === 'string') return value.slice(0, 200);
    }
    return '';
  }

  private errorCode(error: unknown): string {
    const value = error instanceof Error ? error.message : 'SMTP_SEND_FAILED';
    return /^[A-Z0-9_]{3,120}$/.test(value) ? value : 'SMTP_SEND_FAILED';
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
