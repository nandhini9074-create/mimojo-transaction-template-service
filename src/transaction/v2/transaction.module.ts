import { Module } from '@nestjs/common';
import { TransactionV2Controller } from './transaction.controller';
import { SequelizeModule } from '@nestjs/sequelize';
import { ConsumerSaving } from 'src/consumer-saving/entities/consumer-saving.model';
import { ConsumerSavingModule } from 'src/consumer-saving/consumer-saving.module';
import { PayoutConfigurationModule } from 'src/payout-configuration/payout-configuration.module';
import { PayoutConfigurationService } from 'src/payout-configuration/services/payout-configuration.service';
import { PaydaySaving } from 'src/processed-payout/entities/payday-saving.model';
import { Payout } from 'src/processed-payout/entities/payout.model';
import { ProcessedPayout } from 'src/processed-payout/entities/processed-payout.model';
import { ProcessedPayoutService } from 'src/processed-payout/services/processed-payout.service';
import { AuthHeaderService } from 'src/auth/decorators/auth-header.service';
import { ConsumerSavingService } from 'src/consumer-saving/services/consumer-saving.service';
import { PaydaySavingService } from 'src/processed-payout/services/payday-saving.service';
import { ProcessedPayoutModule } from 'src/processed-payout/processed-payout.module';
import { PayoutTransaction } from '../entities/payout-transaction.model';
import { Appeal } from '../entities/appeal.model';
import { PaydayReward } from '../entities/payday-rewards.model';
import { Outlets } from '../entities/payout-merchant-outlet.model';
import { CoreConsumerProxy } from '../proxies/core-consumer.proxy';
import { AppealService } from '../services/appeal.service';
import { PayoutTransactionService } from '../services/payout-transaction.service';
import { Currency } from '../entities/currency.model';
import { PayoutTransactionStatus } from '../entities/payout-status.model';
import { ReceiptService } from '../services/receipt.service';
import { Group } from '../entities/payout-group.model';
import { GroupTransaction } from '../entities/group-transaction.model';
import { Consumer } from '../entities/consumer.model';
import { ConsumerCashback } from '../entities/consumer-cashback.model';
import { SubscriptionServiceProxy } from '../proxies/subscription-service.proxy';
import { CurrencyExchangeRate } from 'src/processed-payout/entities/currency-exchange-rate.model';
import { ThrottlerGuard } from '@nestjs/throttler';

@Module({
  controllers: [TransactionV2Controller],
  providers: [
    ReceiptService,
    PayoutConfigurationService,
    ProcessedPayoutService,
    AuthHeaderService,
    AppealService,
    CoreConsumerProxy,
    PayoutTransactionService,
    ConsumerSavingService,
    PaydaySavingService,
    SubscriptionServiceProxy,
    ThrottlerGuard,
  ],
  imports: [
    ConsumerSavingModule,
    PayoutConfigurationModule,
    ProcessedPayoutModule,
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
    ]),
  ],
  exports: [PayoutTransactionService],
})
export class TransactionV2Module {}
