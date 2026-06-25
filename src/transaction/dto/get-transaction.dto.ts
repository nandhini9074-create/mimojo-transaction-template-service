import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  Min,
  Max,
  IsOptional,
  IsUUID,
  IsISO8601
} from 'class-validator';

export class GetTransactionsDto {
  @ApiPropertyOptional({
    description: 'Page index for pagination (0-based)',
    type: Number,
    minimum: 0,
    example: 0,
  })
  @IsInt()
  @Min(0)
  pageIndex: number;

  @ApiPropertyOptional({
    description: 'Number of records per page (between 1 and 100)',
    type: Number,
    minimum: 1,
    maximum: 100,
    example: 20,
  })
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize: number;

  @ApiPropertyOptional({
    description: 'Filter transactions by Mimojo card UUID',
    format: 'uuid',
    type: String,
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsOptional()
  @IsUUID()
  mimojoCardId?: string;

  @ApiPropertyOptional({
    description: 'Filter transactions from this date (inclusive)',
    format: 'date',
    type: String,
    example: '2024-04-01',
  })
  @IsOptional()
  @IsISO8601()
  fromDate?: string;

  @ApiPropertyOptional({
    description: 'Filter transactions up to this date (inclusive)',
    format: 'date',
    type: String,
    example: '2025-07-01',
  })
  @IsOptional()
  @IsISO8601()
  toDate?: string;
}

export interface TransactionQueryParams {
  userId: string;
  pageIndex?: number;
  pageSize?: number;
  fromDate?: Date;
  toDate?: Date;
  mimojoCardId?: string;
  preferredLanguage?: string;
  merchantPageSize?: number;
}
