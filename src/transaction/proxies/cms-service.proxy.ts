import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { IInternalApis } from 'config/interface';
import { CustomPinoLogger } from 'src/logger/custom-logger.service';

@Injectable()
export class CmsServiceProxy {
  private readonly cmsServiceUrl: string;
  private readonly cmsAdibUrl: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly logger: CustomPinoLogger
  ) {
    const { CMS_PROXY_CARDS_URL, CMS_ADIB_URL } = this.configService.get<IInternalApis>('internal-apis');
    this.cmsServiceUrl = CMS_PROXY_CARDS_URL;
    this.cmsAdibUrl = CMS_ADIB_URL;
  }

  async getUserCards(userId: string) {
    this.logger.info('CmsServiceProxy.getUserCards - started', {userId});
    try {
      const payload = {
        userId
      };
      const response = await axios.post(this.cmsServiceUrl, payload, { timeout: 10000 });
      const cards = response?.data?.data?.cards ?? [];
      this.logger.info('CmsServiceProxy.getUserCards - completed', {cards});
      return cards;
    } catch (ex) {
      this.logger.error('CmsServiceProxy.getUserCards - exception;', { ex, userId });
      throw ex;
    }
  }

  async getParentCardIds(cardIds: string[]) {
    this.logger.info('CmsServiceProxy.getParentCardIds - started', { cardIds });
    try {
      const payload = { cardIds };
      const response = await axios.post(`${this.cmsAdibUrl}/card/parent-card-ids`, payload, {
        timeout: 10000
      });
      const parentCardIds = response?.data?.data?.parentCardIds ?? [];
      this.logger.info('CmsServiceProxy.getParentCardIds - completed', { parentCardIds });
      return parentCardIds;
    } catch (ex) {
      this.logger.error('CmsServiceProxy.getParentCardIds - exception;', { ex, cardIds });
      throw ex;
    }
  }
}
