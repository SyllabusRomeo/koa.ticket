import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UseGuards,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import {
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { PERMISSIONS } from '@logit/shared';
import { RequirePermissions, CurrentUser } from '../auth/decorators';
import type { AuthUserView } from '../auth/auth.service';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PrismaService } from '../prisma/prisma.service';
import { TicketsService } from '../tickets/tickets.service';

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

class CatalogRequestDto {
  @IsOptional()
  @IsString()
  @MaxLength(10000)
  notes?: string;
}

@Controller('catalog')
@UseGuards(SessionAuthGuard, RolesGuard)
export class CatalogController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tickets: TicketsService,
  ) {}

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

  /** One-click: create a ticket from a catalog item. */
  @Post(':id/request')
  async request(
    @CurrentUser() user: AuthUserView,
    @Param('id') id: string,
    @Body() dto: CatalogRequestDto,
  ) {
    if (!user.permissions.includes(PERMISSIONS.TICKETS_WRITE)) {
      throw new ForbiddenException('Cannot create tickets');
    }

    const item = await this.prisma.serviceCatalogItem.findFirst({
      where: {
        isActive: true,
        OR: [{ id }, { code: id.toUpperCase() }],
      },
    });
    if (!item) throw new NotFoundException('Catalog item not found');

    const type = await this.prisma.ticketType.findFirst({
      where: { code: item.ticketTypeCode, isActive: true },
    });
    if (!type) {
      throw new BadRequestException(
        `Catalog item type ${item.ticketTypeCode} is not available`,
      );
    }

    const notes = dto.notes?.trim();
    const description = notes
      ? `${item.description}\n\n---\nRequester notes:\n${notes}`
      : item.description;

    const ticket = await this.tickets.create(user, {
      title: item.name,
      description,
      typeCode: item.ticketTypeCode,
      categoryCode: item.categoryCode ?? undefined,
    });

    const created = ticket as unknown as {
      id: string;
      number: string;
      version: number;
      team?: { id?: string } | null;
    };

    // Prefer catalog default team when assignment rules did not set one.
    if (item.teamId && !created.team?.id) {
      try {
        await this.prisma.ticket.update({
          where: { id: created.id },
          data: { teamId: item.teamId },
        });
        const refreshed = await this.tickets.get(user, created.number);
        return { ticket: refreshed, catalogItem: item };
      } catch {
        /* keep created ticket */
      }
    }

    return { ticket, catalogItem: item };
  }
}
