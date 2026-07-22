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
  AddWorkLogDto,
  CreateTicketDto,
  LinkChildDto,
  MergeTicketsDto,
  UpdateTicketDto,
} from './dto/ticket.dto';
import { TicketPresenceDto } from './dto/presence.dto';
import { TicketsService } from './tickets.service';

@Controller('tickets')
@UseGuards(SessionAuthGuard, RolesGuard)
export class TicketsController {
  constructor(private readonly tickets: TicketsService) {}

  @Get('meta')
  meta() {
    return this.tickets.meta();
  }

  @Get('board')
  board(
    @CurrentUser() user: AuthUserView,
    @Query('scope') scope?: string,
  ) {
    const normalized =
      scope === 'mine' || scope === 'unassigned' || scope === 'all'
        ? scope
        : 'all';
    return this.tickets.board(user, { scope: normalized });
  }

  @Get('major-incidents')
  majorIncidents(@CurrentUser() user: AuthUserView) {
    return this.tickets.majorIncidentsOps(user);
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
  list(
    @CurrentUser() user: AuthUserView,
    @Query('locationId') locationId?: string,
    @Query('typeCode') typeCode?: string,
    @Query('statusCode') statusCode?: string,
    @Query('assigneeId') assigneeId?: string,
    @Query('queue') queue?: string,
    @Query('majorIncident') majorIncident?: string,
  ) {
    return this.tickets.list(user, {
      locationId,
      typeCode,
      statusCode,
      assigneeId,
      queue,
      majorIncident:
        majorIncident === '1' || majorIncident === 'true'
          ? true
          : majorIncident === '0' || majorIncident === 'false'
            ? false
            : undefined,
    });
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

  @Post(':id/watch')
  watch(@CurrentUser() user: AuthUserView, @Param('id') id: string) {
    return this.tickets.watch(user, id);
  }

  @Delete(':id/watch')
  unwatch(@CurrentUser() user: AuthUserView, @Param('id') id: string) {
    return this.tickets.unwatch(user, id);
  }

  @Post(':id/presence')
  heartbeatPresence(
    @CurrentUser() user: AuthUserView,
    @Param('id') id: string,
    @Body() dto: TicketPresenceDto,
  ) {
    return this.tickets.heartbeatPresence(user, id, dto.mode ?? 'viewing');
  }

  @Get(':id/presence')
  listPresence(@CurrentUser() user: AuthUserView, @Param('id') id: string) {
    return this.tickets.listPresence(user, id);
  }

  @Delete(':id/presence')
  leavePresence(@CurrentUser() user: AuthUserView, @Param('id') id: string) {
    return this.tickets.leavePresence(user, id);
  }

  @Post(':id/work-logs')
  addWorkLog(
    @CurrentUser() user: AuthUserView,
    @Param('id') id: string,
    @Body() dto: AddWorkLogDto,
  ) {
    return this.tickets.addWorkLog(user, id, dto);
  }

  @Get(':id/work-logs')
  listWorkLogs(@CurrentUser() user: AuthUserView, @Param('id') id: string) {
    return this.tickets.listWorkLogs(user, id);
  }

  @Post(':id/request-cab')
  requestCab(@CurrentUser() user: AuthUserView, @Param('id') id: string) {
    return this.tickets.requestCab(user, id);
  }

  @Post(':id/promote-problem')
  promoteProblem(@CurrentUser() user: AuthUserView, @Param('id') id: string) {
    return this.tickets.promoteToProblem(user, id);
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
