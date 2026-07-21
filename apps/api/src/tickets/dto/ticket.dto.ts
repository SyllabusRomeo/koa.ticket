import {
  IsArray,
  ArrayMinSize,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

const IMPACT = ['high', 'medium', 'low'] as const;
const URGENCY = ['high', 'medium', 'low'] as const;

export class CreateTicketDto {
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  title!: string;

  @IsString()
  @MinLength(3)
  @MaxLength(10000)
  description!: string;

  @IsString()
  typeCode!: string;

  @IsOptional()
  @IsString()
  categoryCode?: string;

  @IsOptional()
  @IsString()
  subcategoryCode?: string;

  @IsOptional()
  @IsIn(IMPACT)
  impact?: string;

  @IsOptional()
  @IsIn(URGENCY)
  urgency?: string;

  /** Optional parent ticket number or id (child of major / parent incident / problem). */
  @IsOptional()
  @IsString()
  parentNumber?: string;

  /**
   * Ticket origin site. Defaults to the requester's home location when omitted.
   * Pass explicitly to override (e.g. issue at another office).
   */
  @IsOptional()
  @IsString()
  locationId?: string;

  /** Mark as major incident (staff / create path). */
  @IsOptional()
  @IsBoolean()
  majorIncident?: boolean;
}

export class LinkChildDto {
  @IsString()
  @MinLength(3)
  childNumber!: string;
}

export class MergeTicketsDto {
  /** Ticket ids or numbers to merge into the target (:id). */
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  sourceTicketIds!: string[];
}

export class UpdateTicketDto {
  @IsInt()
  @Min(1)
  version!: number;

  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(10000)
  description?: string;

  @IsOptional()
  @IsString()
  statusCode?: string;

  @IsOptional()
  @IsString()
  categoryCode?: string;

  @IsOptional()
  @IsString()
  subcategoryCode?: string;

  @IsOptional()
  @IsIn(IMPACT)
  impact?: string;

  @IsOptional()
  @IsIn(URGENCY)
  urgency?: string;

  @IsOptional()
  @IsString()
  priorityCode?: string;

  @IsOptional()
  @IsBoolean()
  priorityOverride?: boolean;

  @IsOptional()
  @IsString()
  assigneeId?: string | null;

  @IsOptional()
  @IsString()
  teamId?: string | null;

  /** Ticket origin site — staff can correct if wrong. Empty string clears. */
  @IsOptional()
  @IsString()
  locationId?: string | null;

  @IsOptional()
  @IsBoolean()
  majorIncident?: boolean;
}

export class AddCommentDto {
  @IsString()
  @MinLength(1)
  @MaxLength(10000)
  body!: string;

  @IsOptional()
  @IsBoolean()
  isInternal?: boolean;
}

export class AddWorkLogDto {
  @IsInt()
  @Min(1)
  @Max(24 * 60)
  minutes!: number;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;
}
