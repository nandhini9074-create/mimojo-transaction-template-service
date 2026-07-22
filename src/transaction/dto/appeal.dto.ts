import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class AppealDto {
  @ApiProperty({ description: 'The reason for the appeal', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  reason?: string;

  @ApiProperty({ description: 'The note for the appeal', required: false })
  @IsOptional()
  @IsString()
  note?: string;

  @ApiProperty({ description: 'The ID of the transaction', required: false })
  @IsOptional()
  @IsString()
  id?: string;
}
