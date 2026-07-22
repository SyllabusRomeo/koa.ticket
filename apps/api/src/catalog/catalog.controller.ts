import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import {
  Allow,
  IsBoolean,
  IsObject,
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
import {
  buildTicketDescription,
  formatAnswersBlock,
  parseFormSchema,
  validateAnswers,
} from './catalog-form';
import { Prisma } from '@prisma/client';

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

  /** JSON array of CatalogFormField — validated in handler. */
  @IsOptional()
  @Allow()
  formSchema?: unknown;
}

class UpdateCatalogDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @IsOptional()
  @IsString()
  @MinLength(3)
  description?: string;

  @IsOptional()
  @IsString()
  ticketTypeCode?: string;

  @IsOptional()
  @IsString()
  categoryCode?: string | null;

  @IsOptional()
  @IsString()
  teamId?: string | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  /** JSON array of CatalogFormField — validated in handler. Pass null to clear. */
  @IsOptional()
  @Allow()
  formSchema?: unknown;
}

class CatalogRequestDto {
  @IsOptional()
  @IsString()
  @MaxLength(10000)
  notes?: string;

  @IsOptional()
  @IsObject()
  answers?: Record<string, unknown>;
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
    let formSchema: ReturnType<typeof parseFormSchema> | undefined;
    if (dto.formSchema !== undefined) {
      try {
        formSchema = parseFormSchema(dto.formSchema);
      } catch (err) {
        throw new BadRequestException(
          err instanceof Error ? err.message : 'Invalid formSchema',
        );
      }
    }

    return this.prisma.serviceCatalogItem.create({
      data: {
        code: dto.code.toUpperCase(),
        name: dto.name,
        description: dto.description,
        ticketTypeCode: dto.ticketTypeCode,
        categoryCode: dto.categoryCode,
        teamId: dto.teamId,
        formSchema:
          formSchema && formSchema.length > 0
            ? (formSchema as unknown as Prisma.InputJsonValue)
            : undefined,
      },
    });
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.SETTINGS_MANAGE)
  async update(@Param('id') id: string, @Body() dto: UpdateCatalogDto) {
    const item = await this.prisma.serviceCatalogItem.findFirst({
      where: {
        OR: [{ id }, { code: id.toUpperCase() }],
      },
    });
    if (!item) throw new NotFoundException('Catalog item not found');

    const data: Prisma.ServiceCatalogItemUpdateInput = {};

    if (dto.name !== undefined) data.name = dto.name;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.ticketTypeCode !== undefined) data.ticketTypeCode = dto.ticketTypeCode;
    if (dto.categoryCode !== undefined) data.categoryCode = dto.categoryCode;
    if (dto.teamId !== undefined) data.teamId = dto.teamId;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;

    if (dto.formSchema !== undefined) {
      if (dto.formSchema === null) {
        data.formSchema = Prisma.JsonNull;
      } else {
        try {
          const parsed = parseFormSchema(dto.formSchema);
          data.formSchema =
            parsed.length > 0
              ? (parsed as unknown as Prisma.InputJsonValue)
              : Prisma.JsonNull;
        } catch (err) {
          throw new BadRequestException(
            err instanceof Error ? err.message : 'Invalid formSchema',
          );
        }
      }
    }

    return this.prisma.serviceCatalogItem.update({
      where: { id: item.id },
      data,
    });
  }

  /** One-click: create a ticket from a catalog item (optional form answers). */
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

    let schema;
    try {
      schema = parseFormSchema(item.formSchema);
    } catch (err) {
      throw new BadRequestException(
        err instanceof Error
          ? `Catalog form schema invalid: ${err.message}`
          : 'Catalog form schema invalid',
      );
    }

    const { answers, errors } = validateAnswers(schema, dto.answers);
    if (errors.length) {
      throw new BadRequestException(errors.join('; '));
    }

    const answersBlock =
      schema.length > 0 ? formatAnswersBlock(schema, answers) : undefined;
    const description = buildTicketDescription({
      base: item.description,
      answersBlock,
      notes: dto.notes,
    });

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

    try {
      await this.prisma.ticket.update({
        where: { id: created.id },
        data: {
          catalogItemId: item.id,
          catalogAnswers:
            schema.length > 0
              ? (answers as unknown as Prisma.InputJsonValue)
              : undefined,
          ...(item.teamId && !created.team?.id
            ? { teamId: item.teamId }
            : {}),
        },
      });
      const refreshed = await this.tickets.get(user, created.number);
      return { ticket: refreshed, catalogItem: item };
    } catch {
      /* keep created ticket if metadata update fails */
    }

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
