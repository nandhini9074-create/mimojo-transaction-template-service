import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { TransactionController } from './controllers/transaction.controller';
import { TransactionV2Controller } from './controllers/transaction-v2.controller';
import { PayoutTransactionService } from './services/payout-transaction.service';
import { ReceiptService } from './services/receipt.service';
import { PaydaySavingService } from 'src/processed-payout/services/payday-saving.service';
import { PayoutConfigurationService } from 'src/payout-configuration/services/payout-configuration.service';
import { AuthHeaderService } from 'src/auth/decorators/auth-header.service';
import { SubscriptionServiceProxy } from './proxies/subscription-service.proxy';
import { CoreConsumerProxy } from './proxies/core-consumer.proxy';
import { CmsServiceProxy } from './proxies/cms-service.proxy';
import { ConsumerIdentityAdibServiceProxy } from './proxies/consumer-identity-service.proxy';
import { MerchantAdaptorServiceProxy } from './proxies/merchant-adaptor-service.proxy';
import { CommonService } from 'src/common/service/common.service';

// Model Entities
import { PayoutTransaction } from './entities/payout-transaction.model';
import { Appeal } from './entities/appeal.model';
import { Consumer } from './entities/consumer.model';
import { Currency } from './entities/currency.model';
import { Group } from './entities/payout-group.model';
import { GroupTransaction } from './entities/group-transaction.model';
import { PaydayReward } from './entities/payday-rewards.model';
import { Outlets } from './entities/payout-merchant-outlet.model';
import { ConsumerCashback } from './entities/consumer-cashback.model';
import { Payout } from 'src/processed-payout/entities/payout.model';
import { CurrencyExchangeRate } from 'src/processed-payout/entities/currency-exchange-rate.model';
import { PaydaySaving } from 'src/processed-payout/entities/payday-saving.model';
import { ConsumerSaving } from 'src/consumer-saving/entities/consumer-saving.model';

@Module({
  imports: [
    SequelizeModule.forFeature([
      PayoutTransaction,
      Appeal,
      Consumer,
      Currency,
      Group,
      GroupTransaction,
      PaydayReward,
      Outlets,
      ConsumerCashback,
      Payout,
      CurrencyExchangeRate,
      PaydaySaving,
      ConsumerSaving
    ])
  ],
  controllers: [TransactionController, TransactionV2Controller],
  providers: [
    PayoutTransactionService,
    ReceiptService,
    PaydaySavingService,
    PayoutConfigurationService,
    AuthHeaderService,
    SubscriptionServiceProxy,
    CoreConsumerProxy,
    CmsServiceProxy,
    ConsumerIdentityAdibServiceProxy,
    MerchantAdaptorServiceProxy,
    CommonService
  ],
  exports: [
    PayoutTransactionService,
    ReceiptService,
    PaydaySavingService,
    PayoutConfigurationService,
    AuthHeaderService,
    SubscriptionServiceProxy,
    CoreConsumerProxy,
    CmsServiceProxy,
    ConsumerIdentityAdibServiceProxy,
    MerchantAdaptorServiceProxy,
    CommonService
  ]
})
export class TransactionModule {}
