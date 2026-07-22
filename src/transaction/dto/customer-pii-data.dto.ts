import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsString, IsEmail, IsEnum, Length, IsDateString } from 'class-validator';

export enum GenderEnum {
  MALE = 'MALE',
  FEMALE = 'FEMALE',
}

export class CustomerPiiDataDto {
  @ApiPropertyOptional({
    description: 'Mobile phone number',
    maxLength: 20,
    example: '1234567890',
  })
  @IsOptional()
  @IsString()
  @Length(0, 20)
  mobile?: string;

  @ApiPropertyOptional({
    description: 'First name of the customer',
    maxLength: 100,
    example: 'John',
  })
  @IsOptional()
  @IsString()
  @Length(0, 100)
  firstName?: string;

  @ApiPropertyOptional({
    description: 'Last name of the customer',
    maxLength: 100,
    example: 'Doe',
  })
  @IsOptional()
  @IsString()
  @Length(0, 100)
  lastName?: string;

  @ApiPropertyOptional({
    description: 'Email address of the customer',
    maxLength: 200,
    example: 'john.doe@example.com',
  })
  @IsOptional()
  @IsEmail()
  @Length(0, 200)
  email?: string;

  @ApiPropertyOptional({
    description: 'Gender of the customer',
    enum: GenderEnum,
    enumName: 'GenderEnum',
    example: GenderEnum.MALE,
  })
  @IsOptional()
  @IsEnum(GenderEnum)
  @Transform(({ value }) => value?.toUpperCase())
  gender?: GenderEnum;

  @ApiPropertyOptional({
    description: 'Date of birth in ISO 8601 format (YYYY-MM-DD)',
    example: '1990-01-01',
    type: String,
    format: 'date',
  })
  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;

  @ApiPropertyOptional({
    description: 'Nationality of the customer',
    maxLength: 100,
    example: 'American',
  })
  @IsOptional()
  @IsString()
  @Length(0, 100)
  nationality?: string;
}
