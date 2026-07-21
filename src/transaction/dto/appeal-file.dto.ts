import { ApiProperty } from '@nestjs/swagger';

export class AppealDtoWithFile {
  @ApiProperty({ type: 'string', format: 'binary', description: 'The receipt image file' })
  receipt: any;

  @ApiProperty({ description: 'The reason for the appeal', required: false })
  reason?: string;
}
