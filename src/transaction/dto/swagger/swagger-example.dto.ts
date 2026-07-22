import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, MaxLength } from 'class-validator';

export class UploadReceiptImageFileDto {
  @ApiProperty({
    type: 'string',
    description: 'The ID of the receipt image',
    example: '9f7c6f6a-3d2f-4b65-9e8e-123456789abc'
  })
  @IsNotEmpty()
  id: string;

  @ApiProperty({
    type: 'string',
    description: 'The file name of the receipt image',
    example: 'receipt.jpg'
  })
  @IsNotEmpty()
  receiptFileName: string;

  @ApiProperty({
    type: 'string',
    format: 'binary',
    description: 'Upload receipt image file'
  })
  receipt?: any;
}

export class AppealFileDto {
  @ApiProperty({
    type: 'string',
    description: 'The ID of the appeal',
    example: '9f7c6f6a-3d2f-4b65-9e8e-123456789abc'
  })
  @IsNotEmpty()
  id: string;

  @ApiProperty({
    type: 'string',
    description: 'The note for the appeal',
    example: 'I would like to appeal this transaction.'
  })
  @IsNotEmpty()
  @MaxLength(200)
  note: string;

  @ApiProperty({
    type: 'string',
    format: 'binary',
    description: 'Upload receipt image file'
  })
  receipt?: any;
}
