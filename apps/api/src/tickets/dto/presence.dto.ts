import { IsIn, IsOptional } from 'class-validator';

export class TicketPresenceDto {
  @IsOptional()
  @IsIn(['viewing', 'composing'])
  mode?: 'viewing' | 'composing';
}
