import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Res,
  StreamableFile,
} from '@nestjs/common';
import type { Response } from 'express';

import { CurrentCommandContext } from '../request-context/current-command-context.decorator';
import type { CommandContext } from '../request-context/request-context.types';
import { CurrentSession } from '../auth/http/current-session.decorator';
import { RequirePermissions } from '../rbac/http/require-permissions.decorator';
import type { SessionContext } from '../sessions/session.types';
import { CreatePackageDocumentUploadIntentDto } from './dto/create-package-document-upload-intent.dto';
import { PackageDocumentsService } from './package-documents.service';
import type { PackageDocumentRecord } from './package-document.types';

@Controller('packages/:packageId/documents')
export class PackageDocumentsController {
  constructor(private readonly service: PackageDocumentsService) {}

  @Post('upload-intent')
  @RequirePermissions('package_documents.manage')
  @HttpCode(201)
  async createUploadIntent(
    @CurrentSession() session: SessionContext,
    @CurrentCommandContext() context: CommandContext,
    @Param('packageId', new ParseUUIDPipe({ version: '4' })) packageId: string,
    @Body() body: CreatePackageDocumentUploadIntentDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    this.setNoStore(response);
    const result = await this.service.createUploadIntent(
      session.organizationId,
      packageId,
      body,
      context,
    );

    return {
      document: this.serialize(result.document),
      upload: {
        method: result.upload.method,
        url: result.upload.url,
        headers: result.upload.headers,
        expiresAt: result.upload.expiresAt.toISOString(),
      },
    };
  }

  @Post(':documentId/complete')
  @RequirePermissions('package_documents.manage')
  @HttpCode(200)
  async complete(
    @CurrentSession() session: SessionContext,
    @CurrentCommandContext() context: CommandContext,
    @Param('packageId', new ParseUUIDPipe({ version: '4' })) packageId: string,
    @Param('documentId', new ParseUUIDPipe({ version: '4' }))
    documentId: string,
    @Res({ passthrough: true }) response: Response,
  ) {
    this.setNoStore(response);
    const document = await this.service.complete(
      session.organizationId,
      packageId,
      documentId,
      context,
    );

    return this.serialize(document);
  }

  @Get()
  @RequirePermissions('package_documents.read')
  async list(
    @CurrentSession() session: SessionContext,
    @Param('packageId', new ParseUUIDPipe({ version: '4' })) packageId: string,
    @Res({ passthrough: true }) response: Response,
  ) {
    this.setNoStore(response);
    const documents = await this.service.list(
      session.organizationId,
      packageId,
    );

    return {
      items: documents.map((document) => this.serialize(document)),
    };
  }

  @Get(':documentId/download')
  @RequirePermissions('package_documents.read')
  async download(
    @CurrentSession() session: SessionContext,
    @Param('packageId', new ParseUUIDPipe({ version: '4' })) packageId: string,
    @Param('documentId', new ParseUUIDPipe({ version: '4' }))
    documentId: string,
    @Res({ passthrough: true }) response: Response,
  ) {
    this.setNoStore(response);
    const result = await this.service.download(
      session.organizationId,
      packageId,
      documentId,
    );

    response.setHeader('Content-Type', result.contentType);
    if (result.contentLength !== null) {
      response.setHeader('Content-Length', String(result.contentLength));
    }
    response.setHeader(
      'Content-Disposition',
      buildAttachmentDisposition(result.document.originalFilename),
    );

    return new StreamableFile(result.stream);
  }

  @Delete(':documentId')
  @RequirePermissions('package_documents.manage')
  @HttpCode(200)
  async remove(
    @CurrentSession() session: SessionContext,
    @CurrentCommandContext() context: CommandContext,
    @Param('packageId', new ParseUUIDPipe({ version: '4' })) packageId: string,
    @Param('documentId', new ParseUUIDPipe({ version: '4' }))
    documentId: string,
    @Res({ passthrough: true }) response: Response,
  ) {
    this.setNoStore(response);
    const document = await this.service.delete(
      session.organizationId,
      packageId,
      documentId,
      context,
    );

    return this.serialize(document);
  }

  private setNoStore(response: Response): void {
    response.setHeader('Cache-Control', 'no-store');
  }

  private serialize(document: PackageDocumentRecord) {
    return {
      id: document.id,
      packageId: document.packageId,
      documentType: document.documentType,
      status: document.status,
      originalFilename: document.originalFilename,
      contentType: document.contentType,
      contentLength: document.contentLength,
      createdBy: document.createdBy,
      createdAt: document.createdAt.toISOString(),
      availableAt: document.availableAt?.toISOString() ?? null,
      deletedAt: document.deletedAt?.toISOString() ?? null,
    };
  }
}

function buildAttachmentDisposition(filename: string): string {
  const encoded = encodeURIComponent(filename);
  return `attachment; filename*=UTF-8''${encoded}`;
}
