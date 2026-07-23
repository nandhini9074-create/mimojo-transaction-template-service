import { Module } from '@nestjs/common';
import { PayoutConfigurationService } from './services/payout-configuration.service';
import { CustomLoggerModule } from 'src/logger/logger.module';

@Module({
  imports: [CustomLoggerModule],
  providers: [PayoutConfigurationService],
  exports: [PayoutConfigurationService],
})
export class PayoutConfigurationModule {}
