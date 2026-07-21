import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
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

  /** Optional parent ticket number or id (child of major / parent incident). */
  @IsOptional()
  @IsString()
  parentNumber?: string;
}

export class LinkChildDto {
  @IsString()
  @MinLength(3)
  childNumber!: string;
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
