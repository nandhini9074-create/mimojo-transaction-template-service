import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { CustomPinoLogger } from 'src/logger/custom-logger.service';
import { Currency } from 'src/transaction/entities/currency.model';

@Injectable()
export class CommonService {
  constructor(
    @InjectModel(Currency)
    private readonly currency: typeof Currency,
    private readonly logger: CustomPinoLogger
  ) {}

  async getCurrencyByCurrencyCode(currencyCode: string) {
    this.logger.info('CommonService.getCurrencyByCurrencyCode - started', {currencyCode});
    try {
      const consumerCurrency = await this.currency.findOne({
        where: { currencyCode },
        raw: true
      });
      this.logger.info('CommonService.getCurrencyByCurrencyCode - completed', {consumerCurrency});
      return consumerCurrency;
    } catch (error) {
      this.logger.error('CommonService.getCurrencyByCurrencyCode - exception;', { error, currencyCode });
      throw error;
    }
  }
}
