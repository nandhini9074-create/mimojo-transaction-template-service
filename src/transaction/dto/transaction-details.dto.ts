import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class TransactionMerchantQueryDto {
  @ApiProperty({
    description: 'Number of transactions to fetch',
    minimum: 1,
    maximum: 100,
    example: 10,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  transactionSize: number;

  @ApiProperty({
    description: 'Number of merchants to fetch',
    minimum: 1,
    maximum: 100,
    example: 5,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  merchantSize: number;
}
