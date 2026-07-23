import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import {
  IsDateString,
  IsOptional,
  IsString,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { PERMISSIONS } from '@logit/shared';
import { RequirePermissions } from '../auth/decorators';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AssetsService } from './assets.service';

class CreateAssetDto {
  @IsString()
  @MinLength(2)
  assetTag!: string;

  @IsString()
  typeCode!: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  serialNumber?: string;

  @IsOptional()
  @IsString()
  manufacturer?: string;

  @IsOptional()
  @IsString()
  model?: string;

  @IsOptional()
  @IsString()
  assignedUserId?: string;

  @IsOptional()
  @IsString()
  locationId?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsDateString()
  purchaseDate?: string;

  @IsOptional()
  @IsDateString()
  warrantyExpiresAt?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

class UpdateAssetDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  assetTag?: string;

  @IsOptional()
  @IsString()
  typeCode?: string;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  name?: string | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  serialNumber?: string | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  manufacturer?: string | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  model?: string | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== '')
  @IsString()
  assignedUserId?: string | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== '')
  @IsString()
  locationId?: string | null;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== '')
  @IsDateString()
  purchaseDate?: string | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== '')
  @IsDateString()
  warrantyExpiresAt?: string | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  notes?: string | null;
}

class LinkAssetDto {
  @IsString()
  assetId!: string;
}

class CreateRelationDto {
  @IsString()
  toAssetId!: string;

  @IsString()
  relationType!: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

class DiscoveryImportDto {
  @IsOptional()
  @IsString()
  csv?: string;
}

@Controller('assets')
@UseGuards(SessionAuthGuard, RolesGuard)
export class AssetsController {
  constructor(private readonly assets: AssetsService) {}

  @Get('types')
  @RequirePermissions(PERMISSIONS.ASSETS_READ)
  types() {
    return this.assets.types();
  }

  @Get('statuses')
  @RequirePermissions(PERMISSIONS.ASSETS_READ)
  statuses() {
    return this.assets.statuses();
  }

  @Get('relation-types')
  @RequirePermissions(PERMISSIONS.ASSETS_READ)
  relationTypes() {
    return this.assets.relationTypes();
  }

  @Get('assignees')
  @RequirePermissions(PERMISSIONS.ASSETS_WRITE)
  assignees() {
    return this.assets.assignees();
  }

  @Get('export.csv')
  @RequirePermissions(PERMISSIONS.ASSETS_READ)
  @Header('Content-Type', 'text/csv; charset=utf-8')
  async exportCsv(
    @Res() res: Response,
    @Query('status') status?: string,
    @Query('typeCode') typeCode?: string,
    @Query('typeId') typeId?: string,
    @Query('locationId') locationId?: string,
    @Query('q') q?: string,
  ) {
    const csv = await this.assets.exportCsv({
      status,
      typeCode,
      typeId,
      locationId,
      q,
    });
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="logit-assets.csv"',
    );
    res.send(csv);
  }

  @Post('discovery/import')
  @RequirePermissions(PERMISSIONS.ASSETS_WRITE)
  discoveryImport(@Body() dto: DiscoveryImportDto & Record<string, unknown>) {
    return this.assets.discoveryImport({
      csv: dto.csv,
      assets: Array.isArray(dto.assets) ? (dto.assets as never) : undefined,
      relations: Array.isArray(dto.relations)
        ? (dto.relations as never)
        : undefined,
    });
  }

  @Get()
  @RequirePermissions(PERMISSIONS.ASSETS_READ)
  list(
    @Query('status') status?: string,
    @Query('typeCode') typeCode?: string,
    @Query('typeId') typeId?: string,
    @Query('locationId') locationId?: string,
    @Query('q') q?: string,
  ) {
    return this.assets.list({ status, typeCode, typeId, locationId, q });
  }

  @Get(':id/relations')
  @RequirePermissions(PERMISSIONS.ASSETS_READ)
  listRelations(@Param('id') id: string) {
    return this.assets.listRelations(id);
  }

  @Post(':id/relations')
  @RequirePermissions(PERMISSIONS.ASSETS_WRITE)
  createRelation(@Param('id') id: string, @Body() dto: CreateRelationDto) {
    return this.assets.createRelation(id, dto);
  }

  @Delete(':id/relations/:relationId')
  @RequirePermissions(PERMISSIONS.ASSETS_WRITE)
  deleteRelation(
    @Param('id') id: string,
    @Param('relationId') relationId: string,
  ) {
    return this.assets.deleteRelation(id, relationId);
  }

  @Get(':id/impact')
  @RequirePermissions(PERMISSIONS.ASSETS_READ)
  impact(@Param('id') id: string, @Query('depth') depth?: string) {
    const n = depth ? Number(depth) : 2;
    return this.assets.impact(id, Number.isFinite(n) ? n : 2);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.ASSETS_READ)
  get(@Param('id') id: string) {
    return this.assets.get(id);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.ASSETS_WRITE)
  create(@Body() dto: CreateAssetDto) {
    return this.assets.create(dto);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.ASSETS_WRITE)
  update(@Param('id') id: string, @Body() dto: UpdateAssetDto) {
    return this.assets.update(id, dto);
  }

  @Delete(':id')
  @RequirePermissions(PERMISSIONS.ASSETS_WRITE)
  softDelete(@Param('id') id: string) {
    return this.assets.softDelete(id);
  }

  @Post('tickets/:ticketId/link')
  @RequirePermissions(PERMISSIONS.ASSETS_WRITE)
  link(@Param('ticketId') ticketId: string, @Body() dto: LinkAssetDto) {
    return this.assets.linkToTicket(ticketId, dto.assetId);
  }
}
