import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { IInternalApis } from 'config/interface';
import { CustomPinoLogger } from 'src/logger/custom-logger.service';

@Injectable()
export class ConsumerIdentityAdibServiceProxy {
  private readonly consumerIdentityAdibServiceUrl: string;

  constructor(private readonly configService: ConfigService, private readonly logger: CustomPinoLogger) {
    const { CONSUMER_IDENTITY_ADIB_SERVICE_URL } =
      this.configService.get<IInternalApis>('internal-apis');

    this.consumerIdentityAdibServiceUrl = CONSUMER_IDENTITY_ADIB_SERVICE_URL;
  }

  public async getMemberSince(consumerId: string) {
    this.logger.info('ConsumerIdentityAdibServiceProxy.getMemberSince - started', {consumerId});
    try {
      const memberSince = await axios.get(this.consumerIdentityAdibServiceUrl + consumerId);
      return memberSince?.data?.data;
    } catch (ex) {
      this.logger.error('ConsumerIdentityAdibServiceProxy.getMemberSince - exception;', { ex, consumerId });
      throw ex;
    }
  }
}
