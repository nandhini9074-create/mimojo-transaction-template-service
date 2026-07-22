import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { IInternalApis } from 'config/interface';
import { CustomPinoLogger } from 'src/logger/custom-logger.service';

@Injectable()
export class MerchantAdaptorServiceProxy {
  private readonly merchantAdaptorServiceUrl: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly logger: CustomPinoLogger
  ) {
    const { MERCHANT_ADAPTOR_SERVICE_MERCHANTS_API_URL } =
      this.configService.get<IInternalApis>('internal-apis');

    this.merchantAdaptorServiceUrl = MERCHANT_ADAPTOR_SERVICE_MERCHANTS_API_URL;
  }

  async getMerchants(pageSize: number) {
    this.logger.info('MerchantAdaptorServiceProxy.getMerchants - started', {pageSize});
    try {
      const body = {
        pageIndex: 1,
        pageSize,
        excludeCategories: true
      };
      const response = await axios.post(this.merchantAdaptorServiceUrl, body);
      return response?.data?.data?.data ?? [];
    } catch (ex) {
      this.logger.error('MerchantAdaptorServiceProxy.getMerchants - exception;', { ex, pageSize });
      throw ex;
    }
  }
}
