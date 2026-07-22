import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { IInternalApis } from 'config/interface';

@Injectable()
export class SubscriptionServiceProxy {
  private subscriptionServiceUrl: string;

  constructor(private readonly configService: ConfigService) {
    const { SUBSCRIPTION_SERVICE_URL } = this.configService.get<IInternalApis>('internal-apis');

    this.subscriptionServiceUrl = SUBSCRIPTION_SERVICE_URL;
  }

  public async getSubscriptionDateByConsumerId(consumerId: string) {
    try {
      return await axios.get(this.subscriptionServiceUrl + consumerId);
    } catch (ex) {
      throw new InternalServerErrorException(ex);
    }
  }
}
