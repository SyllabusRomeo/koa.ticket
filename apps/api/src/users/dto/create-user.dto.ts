import {
  IsEmail,
  IsOptional,
  IsString,
  MinLength,
  MaxLength,
  IsArray,
  Matches,
} from 'class-validator';

export class CreateUserDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  firstName!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  lastName!: string;

  @IsOptional()
  @IsString()
  @MinLength(12)
  @MaxLength(128)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/, {
    message:
      'Password must include uppercase, lowercase, and a number (min 12 chars)',
  })
  password?: string;

  /** Exactly one primary role (omit for default `employee`). Length > 1 is rejected. */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  roleCodes?: string[];

  @IsOptional()
  @IsString()
  departmentId?: string;

  @IsOptional()
  @IsString()
  locationId?: string;
}
