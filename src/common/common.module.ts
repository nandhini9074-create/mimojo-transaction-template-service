import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { CommonService } from './service/common.service';
import { Currency } from 'src/transaction/entities/currency.model';
import { CustomLoggerModule } from 'src/logger/logger.module';

@Module({
  providers: [CommonService],
  exports: [CommonService],
  imports: [SequelizeModule.forFeature([Currency]), CustomLoggerModule],
})
export class CommonModule {}
