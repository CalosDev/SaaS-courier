import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { CustomsManifestsService } from './customs-manifests.service';
import { CreateCustomsManifestDto } from './dto/create-customs-manifest.dto';
import { UpdateCustomsManifestDto } from './dto/update-customs-manifest.dto';
import { AddPackagesToCustomsManifestDto } from './dto/add-packages.dto';
import { CurrentCommandContext } from '../request-context/current-command-context.decorator';
import type { CommandContext } from '../request-context/request-context.types';
import { RequirePermissions } from '../rbac/http/require-permissions.decorator';
import { CUSTOMS_MANIFEST_PERMISSIONS } from '../rbac/permission.catalog';

@Controller('customs-manifests')
export class CustomsManifestsController {
  constructor(
    private readonly customsManifestsService: CustomsManifestsService,
  ) {}

  @Post()
  @RequirePermissions(CUSTOMS_MANIFEST_PERMISSIONS.MANAGE)
  create(
    @CurrentCommandContext() ctx: CommandContext,
    @Body() dto: CreateCustomsManifestDto,
  ) {
    return this.customsManifestsService.create(ctx, dto);
  }

  @Get(':id')
  @RequirePermissions(CUSTOMS_MANIFEST_PERMISSIONS.VIEW)
  findOne(
    @CurrentCommandContext() ctx: CommandContext,
    @Param('id') id: string,
  ) {
    return this.customsManifestsService.findById(ctx, id);
  }

  @Patch(':id')
  @RequirePermissions(CUSTOMS_MANIFEST_PERMISSIONS.MANAGE)
  update(
    @CurrentCommandContext() ctx: CommandContext,
    @Param('id') id: string,
    @Body() dto: UpdateCustomsManifestDto,
  ) {
    return this.customsManifestsService.update(ctx, id, dto);
  }

  @Post(':id/packages')
  @RequirePermissions(CUSTOMS_MANIFEST_PERMISSIONS.MANAGE)
  @HttpCode(HttpStatus.OK)
  addPackages(
    @CurrentCommandContext() ctx: CommandContext,
    @Param('id') id: string,
    @Body() dto: AddPackagesToCustomsManifestDto,
  ) {
    return this.customsManifestsService.addPackages(ctx, id, dto);
  }

  @Delete(':id/packages')
  @RequirePermissions(CUSTOMS_MANIFEST_PERMISSIONS.MANAGE)
  @HttpCode(HttpStatus.OK)
  removePackages(
    @CurrentCommandContext() ctx: CommandContext,
    @Param('id') id: string,
    @Body() dto: AddPackagesToCustomsManifestDto,
  ) {
    return this.customsManifestsService.removePackages(ctx, id, dto);
  }

  @Post(':id/transmit')
  @RequirePermissions(CUSTOMS_MANIFEST_PERMISSIONS.MANAGE)
  @HttpCode(HttpStatus.OK)
  transmit(
    @CurrentCommandContext() ctx: CommandContext,
    @Param('id') id: string,
  ) {
    return this.customsManifestsService.transmit(ctx, id);
  }
}
