import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UploadedFile,
  UseInterceptors,
  Headers,
  Put,
  Query,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { BaseResponse } from 'src/common/dtos/base-response';
import { PayoutTransactionService } from '../services/payout-transaction.service';
import { AppealDto } from '../dto/appeal.dto';
import { CustomerPiiDataDto } from '../dto/customer-pii-data.dto';
import { GetTransactionsDto } from '../dto/get-transaction.dto';
import { TransactionMerchantQueryDto } from '../dto/transaction-details.dto';
import { ApiEndpoint } from '../../common/decorators/api-swagger';
import { AppealDtoWithFile } from '../dto/appeal-file.dto';
import { ApiBody, ApiConsumes } from '@nestjs/swagger';

@Controller('customers')
export class TransactionController {
  constructor(private readonly payoutTransactionService: PayoutTransactionService) {}

  @Put(':mimojoCustomerId/transactions/:transactionId/appeal')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor('receipt'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: AppealDtoWithFile })
  async appealTransaction(
    @UploadedFile() image: Express.Multer.File,
    @Param('mimojoCustomerId') mimojoCustomerId: string,
    @Param('transactionId') transactionId: string,
    @Body() appealDto: AppealDto
  ) {
    return await this.payoutTransactionService.appeal(transactionId, image, appealDto.reason, mimojoCustomerId);
  }

  @HttpCode(HttpStatus.OK)
  @Get(':mimojoCustomerId/summary')
  @ApiEndpoint({
    summary: 'Get transaction summary',
    description: 'Retrieves the summary of a specific transaction',
    pathParams: [
      { name: 'mimojoCustomerId', description: 'Mimojo customer ID', example: '9f7c6f6a-3d2f-4b65-9e8e-123456789abc' },
    ],
    headers: [{ name: 'language', description: 'Preferred language for the response', required: false, example: 'en' }],
  })
  async getTransactionSummary(
    @Param('mimojoCustomerId') mimojoCustomerId: string,
    @Headers() headers
  ): Promise<BaseResponse<{}>> {
    return await this.payoutTransactionService.getTransactionSummary(mimojoCustomerId, headers?.language);
  }

  @HttpCode(HttpStatus.OK)
  @Post(':mimojoCustomerId/transactions')
  @ApiEndpoint({
    summary: 'Get processed transactions for a customer',
    description: 'Retrieves all processed transactions for a specific customer',
    bodyType: GetTransactionsDto,
    pathParams: [
      { name: 'mimojoCustomerId', description: 'Mimojo customer ID', example: '9f7c6f6a-3d2f-4b65-9e8e-123456789abc' },
    ],
    headers: [{ name: 'language', description: 'Preferred language for the response', required: false, example: 'en' }],
  })
  async getProcessedTransactions(
    @Param('mimojoCustomerId') mimojoCustomerId: string,
    @Body() body: GetTransactionsDto,
    @Headers() headers
  ): Promise<BaseResponse<{}>> {
    return await this.payoutTransactionService.getAllTransactionForUserCards({
      userId: mimojoCustomerId,
      pageIndex: body.pageIndex ?? 1,
      pageSize: body.pageSize ?? 10,
      fromDate: body.fromDate ? new Date(body.fromDate) : null,
      toDate: body.toDate ? new Date(body.toDate) : null,
      mimojoCardId: body.mimojoCardId ?? null,
      preferredLanguage: headers?.language,
    });
  }

  @HttpCode(HttpStatus.OK)
  @Get(':mimojoCustomerId/home')
  @ApiEndpoint({
    summary: 'Get transactions with merchants list for a customer',
    description: 'Retrieves all transactions with their associated merchants for a specific customer',
    pathParams: [
      { name: 'mimojoCustomerId', description: 'Mimojo customer ID', example: '9f7c6f6a-3d2f-4b65-9e8e-123456789abc' },
    ],
    headers: [{ name: 'language', description: 'Preferred language for the response', required: false, example: 'en' }],
    queryType: TransactionMerchantQueryDto,
  })
  async getTransactionWithMerchantList(
    @Param('mimojoCustomerId') mimojoCustomerId: string,
    @Query() query: TransactionMerchantQueryDto,
    @Headers() headers
  ): Promise<BaseResponse<{}>> {
    const { transactionSize, merchantSize } = query;
    return await this.payoutTransactionService.getAllTransactionForUserCards({
      userId: mimojoCustomerId,
      pageIndex: 1,
      pageSize: transactionSize,
      merchantPageSize: merchantSize,
      preferredLanguage: headers.language,
    });
  }

  @HttpCode(HttpStatus.OK)
  @Get(':mimojoCustomerId/cards')
  @ApiEndpoint({
    summary: 'Get all cards for a customer',
    description: 'Retrieves all cards associated with a specific customer',
    pathParams: [
      { name: 'mimojoCustomerId', description: 'Mimojo customer ID', example: '9f7c6f6a-3d2f-4b65-9e8e-123456789abc' },
    ],
    headers: [{ name: 'language', description: 'Preferred language for the response', required: false, example: 'en' }],
  })
  async getCustomerCards(
    @Param('mimojoCustomerId') mimojoCustomerId: string,
    @Headers() headers
  ): Promise<BaseResponse<any>> {
    const customer = await this.payoutTransactionService.getAllCardsForCustomer(mimojoCustomerId, headers.language);
    return customer;
  }

  @HttpCode(HttpStatus.OK)
  @Put(':mimojoCustomerId')
  @ApiEndpoint({
    summary: 'Update customer PII details',
    description: 'Updates personally identifiable information (PII) for a specific customer',
    pathParams: [
      { name: 'mimojoCustomerId', description: 'Mimojo customer ID', example: '9f7c6f6a-3d2f-4b65-9e8e-123456789abc' },
    ],
    bodyType: CustomerPiiDataDto,
  })
  async updateCustomerPiiDetails(
    @Param('mimojoCustomerId') mimojoCustomerId: string,
    @Body() body: CustomerPiiDataDto
  ): Promise<BaseResponse<any>> {
    const customer = await this.payoutTransactionService.updateCustomerPiiDetails(mimojoCustomerId, body);
    return customer;
  }
}
