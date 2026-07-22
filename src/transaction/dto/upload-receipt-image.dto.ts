import { IsNotEmpty, IsOptional } from 'class-validator';

export class UploadReceiptImageDto {
  @IsNotEmpty()
  id: string;

  @IsNotEmpty()
  receiptFileName: string;
}
