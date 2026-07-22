import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IInternalApis } from 'config/interface';
import { CustomPinoLogger } from 'src/logger/custom-logger.service';
let axios = require('axios');

@Injectable()
export class PayoutConfigurationService {
  private readonly nextPaydayApiUrl: string;
  private readonly nextPaydayApiPlusOneDayUrl: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly logger: CustomPinoLogger
  ) {
    const { NEXT_PAYDAY_API, NEXT_PAYDAY_PLUS_ONE_DAY_API } =
      this.configService.get<IInternalApis>('internal-apis');
    this.nextPaydayApiUrl = NEXT_PAYDAY_API;
    this.nextPaydayApiPlusOneDayUrl = NEXT_PAYDAY_PLUS_ONE_DAY_API;
  }

  public async getNextPaydayDate(): Promise<any> {
    this.logger.info('PayoutConfigurationService.getNextPaydayDate - started');
    try {
      return await axios.get(this.nextPaydayApiUrl);
    } catch (error) {
      this.logger.error('PayoutConfigurationService.getNextPaydayDate - exception;', { error });
      throw error;
    }
  }

  public async getNextPaydayDatePlusOneDay(): Promise<any> {
    this.logger.info('PayoutConfigurationService.getNextPaydayDatePlusOneDay - started');
    try {
      return await axios.get(this.nextPaydayApiPlusOneDayUrl);
    } catch (error) {
      this.logger.error('PayoutConfigurationService.getNextPaydayDatePlusOneDay - exception;', { error });
      throw error;
    }
  }
}
