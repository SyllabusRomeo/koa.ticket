import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { IsOptional, IsString, MinLength } from 'class-validator';
import { PERMISSIONS } from '@logit/shared';
import { RequirePermissions } from '../auth/decorators';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PrismaService } from '../prisma/prisma.service';

class CreateCatalogDto {
  @IsString()
  @MinLength(2)
  code!: string;

  @IsString()
  @MinLength(2)
  name!: string;

  @IsString()
  @MinLength(3)
  description!: string;

  @IsString()
  ticketTypeCode!: string;

  @IsOptional()
  @IsString()
  categoryCode?: string;

  @IsOptional()
  @IsString()
  teamId?: string;
}

@Controller('catalog')
@UseGuards(SessionAuthGuard, RolesGuard)
export class CatalogController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  list() {
    return this.prisma.serviceCatalogItem.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });
  }

  @Post()
  @RequirePermissions(PERMISSIONS.SETTINGS_MANAGE)
  create(@Body() dto: CreateCatalogDto) {
    return this.prisma.serviceCatalogItem.create({
      data: {
        code: dto.code.toUpperCase(),
        name: dto.name,
        description: dto.description,
        ticketTypeCode: dto.ticketTypeCode,
        categoryCode: dto.categoryCode,
        teamId: dto.teamId,
      },
    });
  }
}
