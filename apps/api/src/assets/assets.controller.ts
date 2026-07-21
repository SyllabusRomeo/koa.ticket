import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { IsOptional, IsString, MinLength } from 'class-validator';
import { PERMISSIONS } from '@logit/shared';
import { RequirePermissions } from '../auth/decorators';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PrismaService } from '../prisma/prisma.service';

class CreateAssetDto {
  @IsString()
  @MinLength(2)
  assetTag!: string;

  @IsString()
  typeCode!: string;

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
  status?: string;
}

class LinkAssetDto {
  @IsString()
  assetId!: string;
}

@Controller('assets')
@UseGuards(SessionAuthGuard, RolesGuard)
export class AssetsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('types')
  @RequirePermissions(PERMISSIONS.ASSETS_READ)
  types() {
    return this.prisma.assetType.findMany({ orderBy: { name: 'asc' } });
  }

  @Get()
  @RequirePermissions(PERMISSIONS.ASSETS_READ)
  list() {
    return this.prisma.asset.findMany({
      where: { deletedAt: null },
      include: {
        type: true,
        assignedUser: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: { assetTag: 'asc' },
      take: 200,
    });
  }

  @Post()
  @RequirePermissions(PERMISSIONS.ASSETS_WRITE)
  async create(@Body() dto: CreateAssetDto) {
    const type = await this.prisma.assetType.findUnique({
      where: { code: dto.typeCode },
    });
    if (!type) throw new BadRequestException('Invalid asset type');
    return this.prisma.asset.create({
      data: {
        assetTag: dto.assetTag.toUpperCase(),
        typeId: type.id,
        serialNumber: dto.serialNumber,
        manufacturer: dto.manufacturer,
        model: dto.model,
        assignedUserId: dto.assignedUserId,
        status: dto.status ?? 'in_stock',
      },
    });
  }

  @Post('tickets/:ticketId/link')
  @RequirePermissions(PERMISSIONS.ASSETS_WRITE)
  link(@Param('ticketId') ticketId: string, @Body() dto: LinkAssetDto) {
    return this.prisma.ticketAsset.upsert({
      where: {
        ticketId_assetId: { ticketId, assetId: dto.assetId },
      },
      create: { ticketId, assetId: dto.assetId },
      update: {},
    });
  }
}
