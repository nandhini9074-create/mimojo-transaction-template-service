import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { UploadReceiptImageDto } from '../dto/upload-receipt-image.dto';
import { v4 as uuid } from 'uuid';
import { BlobServiceClient, BlockBlobClient } from '@azure/storage-blob';
import { extname } from 'path';
import { EnvKeysEnum } from 'config/env.enum';
import { InjectConnection, InjectModel } from '@nestjs/sequelize';
import { PayoutTransaction } from '../entities/payout-transaction.model';
import { ErrorMessages } from 'src/common/errors/error-messages';
import { CoreConsumerProxy } from '../proxies/core-consumer.proxy';
import { GroupTransaction } from '../entities/group-transaction.model';
import { Sequelize } from 'sequelize-typescript';
import { CustomPinoLogger } from 'src/logger/custom-logger.service';

@Injectable()
export class ReceiptService {
  constructor(
    @InjectModel(PayoutTransaction)
    private readonly payoutTransaction: typeof PayoutTransaction,
    private readonly coreConsumerProxy: CoreConsumerProxy,
    @InjectModel(GroupTransaction)
    private readonly groupTransaction: typeof GroupTransaction,
    @InjectConnection('default')
    private readonly sequelize: Sequelize,
    private readonly logger: CustomPinoLogger
  ) {}

  private getBlobClient(imageName: string): BlockBlobClient {
    const sas = process.env[EnvKeysEnum.RECEIPT_SAS_TOKEN];
    const blobClientService = BlobServiceClient.fromConnectionString(sas);
    const containerClient = blobClientService.getContainerClient(
      process.env[EnvKeysEnum.RECEIPT_CONTAINER]
    );
    const blobClient = containerClient.getBlockBlobClient(imageName);
    return blobClient;
  }

  async appealOnTransaction(transactionId: string, image: Express.Multer.File, note: string, traceId?: string) {
    try {
      this.logger.info('ReceiptService.appealOnTransaction - started', { transactionId, image, note });
      let fileName = null;
      if (image) {
        fileName = await this.uploadReceipt(image);
      }
      const appealRequest = {
        payoutTransactionId: transactionId,
        receipt: fileName,
        note: note,
        traceId
      };
      const response = await this.coreConsumerProxy.postCoreConsumerOnAppeal(appealRequest);
      return { success: response.data.data };
    } catch (error) {
      this.logger.error('PayoutTransactionService.appeal - exception;', {
        error,
        image,
        transactionId,
        traceId,
        note
      });
    }
  }

  async uploadReceiptAndUpdate(paymentTransactionId: string, image: Express.Multer.File) {
    if (image) {
      const id: string = uuid();
      const payoutTrans = await this.payoutTransaction.findOne({
        where: { payoutTransactionId: paymentTransactionId },
        attributes: ['payoutTransactionId', 'transactionId', 'receipt', 'groupTransactionId']
      });
      if (payoutTrans) {
        const fileName = `${id}${extname(image.originalname)}`;
        const blobClient = this.getBlobClient(fileName);
        await blobClient.uploadData(image.buffer);
        await this.updateReceipt(fileName, payoutTrans);
      } else {
        throw new HttpException(ErrorMessages.common.entityNotFound('Transaction').message, HttpStatus.NOT_FOUND);
      }
    }
  }

  private async updateReceipt(fileName: string, payoutTrans: PayoutTransaction) {
    await this.sequelize.transaction(async (transaction) => {
      await this.payoutTransaction.update(
        { receipt: fileName },
        {
          where: {
            payoutTransactionId: payoutTrans.payoutTransactionId
          },
          transaction
        }
      );
      await this.groupTransaction.update(
        { receipt: fileName },
        {
          where: {
            groupTransactionId: payoutTrans?.groupTransactionId
          },
          transaction
        }
      );
    });
  }

  async uploadReceipt(image: Express.Multer.File) {
    this.logger.info('ReceiptService.uploadReceipt - started');
    try {
      if (image) {
        const id: string = uuid();
        let fileExtension = '.jpg';
        if (extname(image.originalname).length > 0) {
          fileExtension = extname(image.originalname);
        }
        const fileName = `${id}${fileExtension}`;
        const blobClient = this.getBlobClient(fileName);
        await blobClient.uploadData(image.buffer);
        return fileName;
      }
    } catch (error) {
      this.logger.error('ReceiptService.uploadReceipt - exception;', { error });
      throw new HttpException(
        error?.response ?? 'uploadReceipt error ',
        error.status ?? HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  async uploadReceiptTransaction(
    uploadReceiptImage: UploadReceiptImageDto,
    image: Express.Multer.File
  ) {
    if (image) {
      const id: string = uuid();
      const payoutTrans = await this.payoutTransaction.findOne({
        where: { payoutTransactionId: uploadReceiptImage.id },
        attributes: ['payoutTransactionId', 'transactionId', 'receipt', 'groupTransactionId']
      });
      if (payoutTrans) {
        const fileName = `${id}${extname(uploadReceiptImage.receiptFileName)}`;
        const blobClient = this.getBlobClient(fileName);
        await blobClient.uploadData(image.buffer);
        await this.updateReceipt(fileName, payoutTrans);
      } else {
        throw new HttpException(ErrorMessages.common.entityNotFound('Transaction').message, HttpStatus.NOT_FOUND);
      }
    }
  }

  async deleteReceiptTransaction(id: string): Promise<any> {
    if (id) {
      const transaction = await this.payoutTransaction.findOne({
        where: { payoutTransactionId: id },
        attributes: ['payoutTransactionId', 'transactionId', 'receipt']
      });
      if (!transaction) {
        throw new HttpException(ErrorMessages.common.entityNotFound('Transaction').message, HttpStatus.NOT_FOUND);
      }
      if (transaction?.receipt) {
        const blobClient = this.getBlobClient(transaction.receipt);
        blobClient.delete();
        await transaction.update({ receipt: null });
      } else {
        throw new HttpException('No receipt found.', HttpStatus.NOT_FOUND);
      }
    }
  }

  getReceiptImageUrl(imageName: string): string {
    if (imageName) {
      const blobClient = this.getBlobClient(imageName);
      return blobClient.url;
    }
  }
}
