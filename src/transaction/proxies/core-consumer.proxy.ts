import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { IInternalApis } from 'config/interface';

@Injectable()
export class CoreConsumerProxy {
  private coreConsumerAppeal: string;

  constructor(private readonly configService: ConfigService) {
    const { CORE_CONSUMER_APPEAL } = this.configService.get<IInternalApis>('internal-apis');

    this.coreConsumerAppeal = CORE_CONSUMER_APPEAL;
  }

  public async postCoreConsumerOnAppeal(appeal: any) {
    try {
      console.log('called', appeal);
      return await axios.post(this.coreConsumerAppeal, appeal);
    } catch (ex) {
      throw new InternalServerErrorException(ex);
    }
  }
}
