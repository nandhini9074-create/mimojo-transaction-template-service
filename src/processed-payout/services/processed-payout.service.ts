import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { ProcessedPayout } from '../entities/processed-payout.model';
import { Payout } from '../entities/payout.model';
import { PaydaySaving } from '../entities/payday-saving.model';
import { PayoutTransaction } from 'src/transaction/entities/payout-transaction.model';
import { Sequelize } from 'sequelize';
import { PayoutTransactionStatus } from 'src/transaction/entities/payout-status.model';
import { Currency } from 'src/transaction/entities/currency.model';
import { ReceiptService } from 'src/transaction/services/receipt.service';
import { Outlets } from 'src/transaction/entities/payout-merchant-outlet.model';

@Injectable()
export class ProcessedPayoutService {
  constructor(
    @InjectModel(ProcessedPayout)
    private readonly processedPayout: typeof ProcessedPayout,
    private readonly receiptService: ReceiptService
  ) {}

  async getPaydayTransaction(userId: any, pageIndex: number, pageSize: number): Promise<any> {
    const order: any = [[Sequelize.col('payout.payoutTransaction.transaction_timestamp'), 'DESC']];
    const include: any = [
      {
        attributes: [],
        model: Payout,
        required: true,
        include: [
          {
            attributes: [],
            model: PayoutTransaction,
            required: true,
            where: { consumerId: userId },
            include: [
              {
                attributes: [],
                model: PayoutTransactionStatus,
                required: true,
              },
              {
                attributes: [],
                model: Currency,
                required: true,
              },
              {
                attributes: [],
                model: Outlets,
                required: true,
              },
            ],
          },
        ],
      },
      {
        attributes: [],
        model: PaydaySaving,
        required: true,
      },
    ];

    const result = await this.processedPayout.findAndCountAll({
      offset: pageIndex * pageSize,
      limit: pageSize,
      attributes: [
        [Sequelize.col('payout.payoutTransaction.payout_transaction_id'), 'transactionId'],
        [Sequelize.col('payout.payoutTransaction.transaction_timestamp'), 'transactionDate'],
        [Sequelize.col('payout.payoutTransaction.outlets.outlet_name'), 'outletName'],
        [Sequelize.col('payout.payoutTransaction.outlets.category_logo'), 'categoryLogo'],
        [Sequelize.cast(Sequelize.col('payout.payoutTransaction.cashback_amount'), 'DECIMAL(10,2)'), 'cashbackAmount'],
        [Sequelize.col('payout.payoutTransaction.payoutTransactionStatus.status'), 'transactionStatus'],
        [Sequelize.col('payout.payoutTransaction.currency.currency_code'), 'currency'],
        [Sequelize.col('payout.payoutTransaction.receipt'), 'receipt'],
        [Sequelize.col('paydaySaving.payday_date'), 'paydayDate'],
        [Sequelize.cast(Sequelize.col('paydaySaving.payday_total_saving_amount'), 'DECIMAL(10,2)'), 'paydaySavingAmount'],
      ],
      //where: where,
      include: include,
      order: order,
    });

    const formattedResult = [];
    for (const transaction of result.rows) {
      const transactionData = {
        transactionId: transaction.dataValues['transactionId'],
        categoryImage: transaction.dataValues['categoryLogo'],
        outletName: transaction.dataValues['outletName'],
        cashbackAmount: Number(transaction.dataValues['cashbackAmount']),
        transactionDate: transaction.dataValues['transactionDate'],
        transactionStatus: transaction.dataValues['transactionStatus'],
        receipt: this.receiptService.getReceiptImageUrl(transaction.dataValues['receipt']),
        paydayDate: transaction.dataValues['paydayDate'],
        paydaySavingAmount: Number(transaction.dataValues['paydaySavingAmount']),
        currency: transaction.dataValues['currency'],
      };
      formattedResult.push(transactionData);
    }

    return {
      data: formattedResult,
      pagination: {
        page: pageIndex,
        pageCount: Math.ceil(result.count / pageSize),
        total: result.count,
        count: result.rows.length,
      },
    };
  }
}
