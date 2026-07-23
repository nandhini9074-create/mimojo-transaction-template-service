import { Module } from '@nestjs/common';
import { TransactionController } from './controllers/transaction.controller';
import { SequelizeModule } from '@nestjs/sequelize';
import { ConsumerSaving } from 'src/consumer-saving/entities/consumer-saving.model';
import { ConsumerSavingModule } from 'src/consumer-saving/consumer-saving.module';
import { PayoutConfigurationModule } from 'src/payout-configuration/payout-configuration.module';

import { PayoutConfigurationService } from 'src/payout-configuration/services/payout-configuration.service';
import { PaydaySaving } from 'src/processed-payout/entities/payday-saving.model';
import { Payout } from 'src/processed-payout/entities/payout.model';
import { ProcessedPayout } from 'src/processed-payout/entities/processed-payout.model';
import { PaydaySavingService } from 'src/processed-payout/services/payday-saving.service';
import { ProcessedPayoutModule } from 'src/processed-payout/processed-payout.module';
import { PayoutTransaction } from './entities/payout-transaction.model';
import { Appeal } from './entities/appeal.model';
import { PaydayReward } from './entities/payday-rewards.model';
import { Outlets } from './entities/payout-merchant-outlet.model';
import { CoreConsumerProxy } from './proxies/core-consumer.proxy';
import { PayoutTransactionService } from './services/payout-transaction.service';
import { Currency } from './entities/currency.model';
import { PayoutTransactionStatus } from './entities/payout-status.model';
import { ReceiptService } from './services/receipt.service';
import { Group } from './entities/payout-group.model';
import { GroupTransaction } from './entities/group-transaction.model';
import { Consumer } from './entities/consumer.model';
import { ConsumerCashback } from './entities/consumer-cashback.model';
import { CurrencyExchangeRate } from 'src/processed-payout/entities/currency-exchange-rate.model';
import { CmsServiceProxy } from './proxies/cms-service.proxy';
import { ConsumerIdentityAdibServiceProxy } from './proxies/consumer-identity-service.proxy';
import { CommonModule } from 'src/common/common.module';
import { MerchantAdaptorServiceProxy } from './proxies/merchant-adaptor-service.proxy';
import { CustomLoggerModule } from 'src/logger/logger.module';
import { PayoutTransactionMeta } from './entities/payout-transaction-meta.model';

@Module({
  controllers: [TransactionController],
  providers: [
    ReceiptService,
    PayoutConfigurationService,
    CoreConsumerProxy,
    PayoutTransactionService,
    PaydaySavingService,
    CmsServiceProxy,
    ConsumerIdentityAdibServiceProxy,
    MerchantAdaptorServiceProxy,
  ],
  imports: [
    ConsumerSavingModule,
    PayoutConfigurationModule,
    ProcessedPayoutModule,
    CommonModule,
    CustomLoggerModule,
    SequelizeModule.forFeature([
      PayoutTransaction,
      PayoutTransactionStatus,
      Currency,
      PaydayReward,
      ConsumerSaving,
      PaydaySaving,
      Payout,
      ProcessedPayout,
      Appeal,
      Outlets,
      Group,
      GroupTransaction,
      Consumer,
      ConsumerCashback,
      CurrencyExchangeRate,
      PayoutTransactionMeta,
    ]),
  ],
  exports: [PayoutTransactionService, CoreConsumerProxy, ReceiptService],
})
export class TransactionModule {}
