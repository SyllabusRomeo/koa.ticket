import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Param,
  Patch,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { CurrentUser } from '../auth/decorators';
import type { AuthUserView } from '../auth/auth.service';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import {
  AddCommentDto,
  CreateTicketDto,
  LinkChildDto,
  MergeTicketsDto,
  UpdateTicketDto,
} from './dto/ticket.dto';
import { TicketsService } from './tickets.service';

@Controller('tickets')
@UseGuards(SessionAuthGuard, RolesGuard)
export class TicketsController {
  constructor(private readonly tickets: TicketsService) {}

  @Get('meta')
  meta() {
    return this.tickets.meta();
  }

  @Get('export.csv')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  async exportCsv(
    @CurrentUser() user: AuthUserView,
    @Req() req: { ip?: string },
    @Res() res: Response,
  ) {
    const csv = await this.tickets.exportCsv(user, req.ip);
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="logit-tickets.csv"',
    );
    res.send(csv);
  }

  @Get()
  list(@CurrentUser() user: AuthUserView) {
    return this.tickets.list(user);
  }

  @Post()
  create(@CurrentUser() user: AuthUserView, @Body() dto: CreateTicketDto) {
    return this.tickets.create(user, dto);
  }

  @Get(':id')
  get(@CurrentUser() user: AuthUserView, @Param('id') id: string) {
    return this.tickets.get(user, id);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthUserView,
    @Param('id') id: string,
    @Body() dto: UpdateTicketDto,
  ) {
    return this.tickets.update(user, id, dto);
  }

  @Delete(':id')
  softDelete(@CurrentUser() user: AuthUserView, @Param('id') id: string) {
    return this.tickets.softDelete(user, id);
  }

  @Post(':id/comments')
  comment(
    @CurrentUser() user: AuthUserView,
    @Param('id') id: string,
    @Body() dto: AddCommentDto,
  ) {
    return this.tickets.addComment(user, id, dto);
  }

  @Post(':id/merge')
  merge(
    @CurrentUser() user: AuthUserView,
    @Param('id') id: string,
    @Body() dto: MergeTicketsDto,
  ) {
    return this.tickets.merge(user, id, dto.sourceTicketIds);
  }

  @Post(':id/children')
  linkChild(
    @CurrentUser() user: AuthUserView,
    @Param('id') id: string,
    @Body() dto: LinkChildDto,
  ) {
    return this.tickets.linkChild(user, id, dto.childNumber);
  }

  @Delete(':id/children/:childId')
  unlinkChild(
    @CurrentUser() user: AuthUserView,
    @Param('id') id: string,
    @Param('childId') childId: string,
  ) {
    return this.tickets.unlinkChild(user, id, childId);
  }
}
