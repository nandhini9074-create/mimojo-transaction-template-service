import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
  Headers,
  UseGuards,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { BaseResponse } from 'src/common/dtos/base-response';
import { baseResponseHelper } from 'src/common/helpers/base-response.helper';
import { AuthHeaderService } from 'src/auth/decorators/auth-header.service';
import { ReceiptService } from '../services/receipt.service';
import { PayoutTransactionService } from '../services/payout-transaction.service';
import { UploadReceiptImageDto } from '../dto/upload-receipt-image.dto';
import { AppealDto } from '../dto/appeal.dto';
import { ApiEndpoint } from 'src/common/decorators/api-swagger';
import { ApiConsumes } from '@nestjs/swagger';
import { AppealFileDto, UploadReceiptImageFileDto } from '../dto/swagger/swagger-example.dto';
import { ThrottlerGuard } from '@nestjs/throttler';

@Controller({ version: '2', path: 'transaction' })
export class TransactionV2Controller {
  constructor(
    private readonly receiptService: ReceiptService,
    private readonly payoutTransactionService: PayoutTransactionService,
    private readonly authHeaderService: AuthHeaderService
  ) {}

  @HttpCode(HttpStatus.OK)
  @Delete('/receipt/:id')
  @ApiEndpoint({
    summary: 'Delete Receipt Image',
    description: 'Deletes a receipt image by its ID.',
    includeLanguageHeader: true,
    pathParams: [
      {
        name: 'id',
        description: 'The ID of the receipt image to delete',
        type: 'string',
        example: '9f7c6f6a-3d2f-4b65-9e8e-123456789abc',
      },
    ],
  })
  async DeleteReciptImage(@Param('id') id: string, @Headers() headers): Promise<BaseResponse<{}>> {
    await this.receiptService.deleteReceiptTransaction(id);
    return baseResponseHelper(await this.payoutTransactionService.getPaydayTransactionByIdV2(id, headers.language));
  }

  @HttpCode(HttpStatus.OK)
  @Post('receipt-upload')
  @UseInterceptors(FileInterceptor('receipt'))
  @ApiConsumes('multipart/form-data')
  @ApiEndpoint({
    summary: 'Upload Receipt Image',
    description: 'Uploads a receipt image.',
    includeLanguageHeader: true,
    bodyType: UploadReceiptImageFileDto,
  })
  async uploadReceiptImage(
    @UploadedFile() image: Express.Multer.File,
    @Body() uploadReceiptImage: UploadReceiptImageDto,
    @Headers() headers
  ): Promise<BaseResponse<{}>> {
    return baseResponseHelper(
      await this.payoutTransactionService.uploadReceiptV2(uploadReceiptImage, image, headers.language)
    );
  }

  @HttpCode(HttpStatus.OK)
  @Post('appeal')
  @UseInterceptors(FileInterceptor('receipt'))
  @ApiConsumes('multipart/form-data')
  @ApiEndpoint({
    summary: 'Appeal Transaction',
    description: 'Submits an appeal for a transaction.',
    includeLanguageHeader: true,
    bodyType: AppealFileDto,
  })
  async appealTransaction(@UploadedFile() image: Express.Multer.File, @Body() appealDto: AppealDto, @Headers() headers) {
    return baseResponseHelper(
      await this.payoutTransactionService.appealV2(appealDto.id, image, appealDto.note, headers.language)
    );
  }

  @HttpCode(HttpStatus.OK)
  @Get('get-transaction-summary')
  @ApiEndpoint({
    summary: 'Get Transaction Summary',
    description: 'Retrieves the summary of a transaction.',
    includeLanguageHeader: true,
  })
  async getTransactionSummery(@Headers() headers): Promise<BaseResponse<{}>> {
    let userId = await this.authHeaderService.getUserId(headers.authorization);
    return baseResponseHelper(await this.payoutTransactionService.getTransactionSummary(userId, headers.language));
  }

  @HttpCode(HttpStatus.OK)
  @Get('get-transaction')
  @ApiEndpoint({
    summary: 'Get Transaction',
    description: 'Retrieves a paginated list of transactions.',
    includeLanguageHeader: true,
    queries: [
      { name: 'pageIndex', required: true, example: 1 },
      { name: 'pageSize', required: true, example: 10 },
    ],
  })
  async getTransaction(
    @Headers() headers,
    @Query('pageIndex') pageIndex: number,
    @Query('pageSize') pageSize: number
  ): Promise<BaseResponse<{}>> {
    let userId = await this.authHeaderService.getUserId(headers.authorization);
    return baseResponseHelper(
      await this.payoutTransactionService.getNextPaydayTransactionV2(userId, pageIndex, pageSize, headers.language)
    );
  }

  @HttpCode(HttpStatus.OK)
  @Get('get-processed-transaction')
  @ApiEndpoint({
    summary: 'Get Processed Transaction',
    description: 'Retrieves a paginated list of processed transactions.',
    includeLanguageHeader: true,
    queries: [
      { name: 'pageIndex', required: true, example: 1 },
      { name: 'pageSize', required: true, example: 10 },
    ],
  })
  async getProcessedTransaction(
    @Headers() headers,
    @Query('pageIndex') pageIndex: number,
    @Query('pageSize') pageSize: number
  ): Promise<BaseResponse<{}>> {
    let userId = await this.authHeaderService.getUserId(headers.authorization);
    return baseResponseHelper(
      await this.payoutTransactionService.getAllPaydayTransactionV2(userId, pageIndex, pageSize, headers.language)
    );
  }

  @HttpCode(HttpStatus.OK)
  @UseGuards(ThrottlerGuard)
  @Get('get-details-for-dashboard')
  async getTransactionDetailsForDashboard(): Promise<
    BaseResponse<{ count: number; last24HoursCount: number; totalPayoutsDone: number } | {}>
  > {
    const response = await this.payoutTransactionService.getTransactionDetailsForDashboard();
    return response;
  }

  @HttpCode(HttpStatus.OK)
  @UseGuards(ThrottlerGuard)
  @Get('get-payday-details-for-dashboard')
  async getPaydayDetailsForDashboard(
    @Headers() headers: { timezoneinfo?: string },
    @Query('paymentDate') paymentDate: string
  ): Promise<BaseResponse<{ successCount: number; failedCount: number } | {}>> {
    const response = await this.payoutTransactionService.getPaydayDetailsForDashboard(paymentDate, headers.timezoneinfo);
    return response;
  }

  @Get(':id')
  @HttpCode(200)
  @ApiEndpoint({
    summary: 'Get Transaction By ID',
    description: 'Retrieves a transaction by its ID.',
    includeLanguageHeader: true,
    pathParams: [{ name: 'id', example: '9f7c6f6a-3d2f-4b65-9e8e-123456789abc', type: 'string' }],
  })
  async getTransactionById(@Param('id') id: string, @Headers() headers): Promise<BaseResponse<{}>> {
    let res = await this.payoutTransactionService.getTransactionDetailsV2(id, headers.language);
    return baseResponseHelper(res);
  }
}
