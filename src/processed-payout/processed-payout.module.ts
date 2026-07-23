import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { ProcessedPayout } from 'src/processed-payout/entities/processed-payout.model';
import { ReceiptService } from 'src/transaction/services/receipt.service';
import { PayoutTransaction } from 'src/transaction/entities/payout-transaction.model';
import { Appeal } from 'src/transaction/entities/appeal.model';
import { CoreConsumerProxy } from 'src/transaction/proxies/core-consumer.proxy';
import { PaydaySavingService } from './services/payday-saving.service';
import { PaydaySaving } from './entities/payday-saving.model';
import { Payout } from './entities/payout.model';
import { GroupTransaction } from 'src/transaction/entities/group-transaction.model';
import { CurrencyExchangeRate } from './entities/currency-exchange-rate.model';
import { CommonModule } from 'src/common/common.module';
import { CustomLoggerModule } from 'src/logger/logger.module';

@Module({
  providers: [ReceiptService, CoreConsumerProxy, PaydaySavingService],
  exports: [PaydaySavingService],
  imports: [
    SequelizeModule.forFeature([
      GroupTransaction,
      ProcessedPayout,
      PayoutTransaction,
      Appeal,
      PaydaySaving,
      Payout,
      CurrencyExchangeRate,
    ]),
    CommonModule,
    CustomLoggerModule,
  ],
})
export class ProcessedPayoutModule {}
