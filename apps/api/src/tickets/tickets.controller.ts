import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators';
import type { AuthUserView } from '../auth/auth.service';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import {
  AddCommentDto,
  CreateTicketDto,
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

  @Post(':id/comments')
  comment(
    @CurrentUser() user: AuthUserView,
    @Param('id') id: string,
    @Body() dto: AddCommentDto,
  ) {
    return this.tickets.addComment(user, id, dto);
  }
}
