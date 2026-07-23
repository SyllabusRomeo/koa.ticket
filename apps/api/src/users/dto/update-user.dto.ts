import {
  IsBoolean,
  IsOptional,
  IsString,
  MinLength,
  MaxLength,
} from 'class-validator';

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  firstName?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  lastName?: string;

  /** Home / default location for the user (also stamps new tickets). */
  @IsOptional()
  @IsString()
  locationId?: string | null;

  @IsOptional()
  @IsString()
  departmentId?: string | null;

  /** Soft activate / deactivate (login blocked when false). */
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
