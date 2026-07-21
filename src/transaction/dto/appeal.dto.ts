import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class AppealDto {
  @ApiProperty({ description: 'The reason for the appeal', required: false })
  @IsOptional()
  @IsString()
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
