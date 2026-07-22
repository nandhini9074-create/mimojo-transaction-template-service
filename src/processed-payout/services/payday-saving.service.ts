import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { PaydaySaving } from '../entities/payday-saving.model';
import { Op, Sequelize } from 'sequelize';
import { CurrencyExchangeRate } from '../entities/currency-exchange-rate.model';
import { Currency } from 'src/transaction/entities/currency.model';
import { ConfigService } from '@nestjs/config';
import { IInternalApis } from 'config/interface';
import { CommonService } from 'src/common/service/common.service';
import { EnvKeysEnum } from 'config/env.enum';
import { CustomPinoLogger } from 'src/logger/custom-logger.service';

@Injectable()
export class PaydaySavingService {
  private readonly mimojoProfileId: string;

  constructor(
    @InjectModel(PaydaySaving)
    private readonly paydaySaving: typeof PaydaySaving,
    @InjectModel(CurrencyExchangeRate)
    private readonly currencyExchangeRate: typeof CurrencyExchangeRate,
    private readonly configService: ConfigService,
    private readonly commonService: CommonService,
    private readonly logger: CustomPinoLogger
  ) {
    const { MIMOJO_PROFILE_ID } = this.configService.get<IInternalApis>('internal-apis');
    this.mimojoProfileId = MIMOJO_PROFILE_ID;
  }

  /**
   * V1 variant: Get card-wise total savings by userId + currency (used by V1 controller)
   */
  public async getCardWiseTotalSavingByUser(
    userId: string,
    userBaseCurrencyId: string,
    userBaseCurrency: Currency,
    preferredLanguage: string
  ): Promise<any[]> {
    const retValue: any[] = [];
    const savingGroupByCurrencyCards = await this.paydaySaving.findAll({
      attributes: [
        'cardId',
        'currencyId',
        'paydayDate',
        [Sequelize.fn('SUM', Sequelize.col('payday_saving_amount')), 'saving']
      ],
      where: {
        consumerId: userId,
        profileId: this.mimojoProfileId
      },
      group: ['cardId', 'currencyId', 'paydayDate']
    });

    const cardIds = savingGroupByCurrencyCards.map((p) => p.cardId);
    const distinctCardIds = [...new Set(cardIds)];

    for (const cardId of distinctCardIds) {
      const sumOfUserAllBaseCurrency = savingGroupByCurrencyCards.filter(
        (p) => p.currencyId === userBaseCurrencyId && p.cardId === cardId
      );
      const sumOfAllOtherCurrencies = savingGroupByCurrencyCards.filter(
        (p) => p.currencyId != userBaseCurrencyId && p.cardId === cardId
      );
      const sumCardwise = await this.getSumOfUserBaseCurrencyV1(
        sumOfAllOtherCurrencies,
        userBaseCurrencyId,
        sumOfUserAllBaseCurrency
      );
      const currency =
        preferredLanguage === 'ar'
          ? userBaseCurrency.currencyCodeAr
          : userBaseCurrency.currencyCode;
      retValue.push({
        cardId: cardId,
        currency: currency,
        saving: sumCardwise.customerTotalSaving
      });
    }

    // Format the 'saving' attribute
    const formattedSavings = retValue.map((saving) => {
      return {
        ...saving,
        saving: Number(saving.saving).toLocaleString('en-US', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2
        })
      };
    });

    return formattedSavings;
  }

  /**
   * V2 variant: Get card-wise total savings by card IDs array (used by ADIB/V2 controller)
   */
  public async getCardWiseTotalSaving(userCards: string[]) {
    this.logger.info('PaydaySavingService.getCardWiseTotalSaving - started', { userCards });
    try {
      const userBaseCurrency = await this.commonService.getCurrencyByCurrencyCode('AED');
      const userBaseCurrencyId = userBaseCurrency?.currencyId;

      const retValue: any[] = [];
      const savingGroupByCurrencyCards = await this.paydaySaving.findAll({
        attributes: [
          'cardId',
          'currencyId',
          'paydayDate',
          [Sequelize.fn('SUM', Sequelize.col('payday_saving_amount')), 'saving']
        ],
        where: {
          cardId: {
            [Op.in]: userCards
          },
          profileId: process.env[EnvKeysEnum.ADIB_PROFILE_ID]
        },
        group: ['cardId', 'currencyId', 'paydayDate']
      });

      const cardIds = savingGroupByCurrencyCards.map((p) => p.cardId);
      const distinctCardIds = [...new Set(cardIds)];

      for (const cardId of distinctCardIds) {
        const sumOfUserAllBaseCurrency = savingGroupByCurrencyCards.filter(
          (p) => p.currencyId === userBaseCurrencyId && p.cardId === cardId
        );
        const sumOfAllOtherCurrencies = savingGroupByCurrencyCards.filter(
          (p) => p.currencyId != userBaseCurrencyId && p.cardId === cardId
        );
        const sumCardwise = await this.getSumOfUserBaseCurrencyV2(
          sumOfAllOtherCurrencies,
          userBaseCurrencyId,
          sumOfUserAllBaseCurrency
        );
        retValue.push({ cardId: cardId, saving: sumCardwise });
      }

      const formattedSavings = retValue.map((saving) => {
        return {
          ...saving,
          saving: Number(saving.saving).toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
          })
        };
      });

      return formattedSavings;
    } catch (error) {
      this.logger.error('PaydaySavingService.getCardWiseTotalSaving - exception;', { error, userCards });
      throw new HttpException(
        error?.response ?? 'getCardWiseTotalSaving error ',
        error.status ?? HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * V1 variant: Get lifetime savings by userId
   */
  public async getConsumerLifetimeSavingByUserId(userId: string, userBaseCurrencyId: string) {
    const savingGroupByCurrency = await this.paydaySaving.findAll({
      attributes: [
        'currencyId',
        'paydayDate',
        [Sequelize.fn('SUM', Sequelize.col('payday_saving_amount')), 'saving']
      ],
      where: {
        consumerId: userId
      },
      group: ['currencyId', 'paydayDate']
    });

    const sumOfUserAllBaseCurrency = savingGroupByCurrency.filter(
      (p) => p.currencyId === userBaseCurrencyId
    );
    const sumOfAllOtherCurrencies = savingGroupByCurrency.filter(
      (p) => p.currencyId != userBaseCurrencyId
    );

    return await this.getSumOfUserBaseCurrencyV1(
      sumOfAllOtherCurrencies,
      userBaseCurrencyId,
      sumOfUserAllBaseCurrency
    );
  }

  /**
   * V2 variant: Get lifetime savings by card IDs and user base currency
   */
  public async getConsumerLifetimeSaving(
    userBaseCurrencyId: string,
    userCardIds: string[]
  ): Promise<number> {
    this.logger.info('PaydaySavingService.getConsumerLifetimeSaving - started', { userBaseCurrencyId, userCardIds });
    try {
      const savingGroupByCurrency = await this.paydaySaving.findAll({
        attributes: [
          'currencyId',
          'paydayDate',
          [Sequelize.fn('SUM', Sequelize.col('payday_saving_amount')), 'saving']
        ],
        where: {
          cardId: { [Op.in]: userCardIds },
          currencyId: userBaseCurrencyId,
          profileId: process.env[EnvKeysEnum.ADIB_PROFILE_ID]
        },
        group: ['currencyId', 'paydayDate']
      });

      const sumOfUserAllBaseCurrency = savingGroupByCurrency.filter(
        (p) => p.currencyId === userBaseCurrencyId
      );
      const sumOfAllOtherCurrencies = savingGroupByCurrency.filter(
        (p) => p.currencyId != userBaseCurrencyId
      );
      return await this.getSumOfUserBaseCurrencyV2(
        sumOfAllOtherCurrencies,
        userBaseCurrencyId,
        sumOfUserAllBaseCurrency
      );
    } catch (error) {
      this.logger.error('PaydaySavingService.getConsumerLifetimeSaving - exception;', { error, userBaseCurrencyId, userCardIds });
      throw new HttpException(
        error?.response ?? 'getConsumerLifetimeSaving error ',
        error.status ?? HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /** V1 internal helper - returns { customerTotalSaving, currencyCode } */
  private async getSumOfUserBaseCurrencyV1(
    sumOfAllOtherCurrencies: PaydaySaving[],
    userBaseCurrencyId: string,
    sumOfUserAllBaseCurrency: PaydaySaving[]
  ) {
    let sumOfAllOtherCurrenciesToBaseCurrencyAmount = 0;
    let sumOfAllOtherCurrenciesToUserBaseCurrencyAmount = 0;
    for (const sumOfForeignCurrency of sumOfAllOtherCurrencies) {
      const exchangeRate = await this.getExchangeRateDefault(
        sumOfForeignCurrency.currencyId,
        sumOfForeignCurrency?.paydayDate
      );
      sumOfAllOtherCurrenciesToBaseCurrencyAmount +=
        sumOfForeignCurrency?.dataValues['saving'] * exchangeRate?.baseCurrencyEquivalentAmount;
    }

    if (userBaseCurrencyId != '9ef4e24c-44b6-48a3-83f5-44f209d37554') {
      const userBaseCurrencyExchangeRate = await this.currencyExchangeRate.findOne({
        where: {
          foreignCurrencyId: userBaseCurrencyId
        }
      });
      sumOfAllOtherCurrenciesToUserBaseCurrencyAmount =
        sumOfAllOtherCurrenciesToBaseCurrencyAmount /
        userBaseCurrencyExchangeRate.baseCurrencyEquivalentAmount;
    } else {
      sumOfAllOtherCurrenciesToUserBaseCurrencyAmount = sumOfAllOtherCurrenciesToBaseCurrencyAmount;
    }

    for (const sumOfUserBaseCurrency of sumOfUserAllBaseCurrency) {
      sumOfAllOtherCurrenciesToUserBaseCurrencyAmount += Number(
        sumOfUserBaseCurrency?.dataValues['saving']
      );
    }

    return {
      customerTotalSaving: sumOfAllOtherCurrenciesToUserBaseCurrencyAmount,
      currencyCode: userBaseCurrencyId
    };
  }

  /** V2 internal helper - returns plain number */
  private async getSumOfUserBaseCurrencyV2(
    sumOfAllOtherCurrencies: PaydaySaving[],
    userBaseCurrencyId: string,
    sumOfUserAllBaseCurrency: PaydaySaving[]
  ) {
    this.logger.info('PaydaySavingService.getSumOfUserBaseCurrency - started', { sumOfAllOtherCurrencies, userBaseCurrencyId, sumOfUserAllBaseCurrency });
    try {
      let sumOfAllOtherCurrenciesToBaseCurrencyAmount = 0;
      let sumOfAllOtherCurrenciesToUserBaseCurrencyAmount = 0;
      for (const sumOfForeignCurrency of sumOfAllOtherCurrencies) {
        const exchangeRate = await this.getExchangeRateDefault(
          sumOfForeignCurrency.currencyId,
          sumOfForeignCurrency?.paydayDate
        );
        sumOfAllOtherCurrenciesToBaseCurrencyAmount +=
          sumOfForeignCurrency?.dataValues['saving'] * exchangeRate?.baseCurrencyEquivalentAmount;
      }

      if (userBaseCurrencyId != '9ef4e24c-44b6-48a3-83f5-44f209d37554') {
        const userBaseCurrencyExchangeRate = await this.currencyExchangeRate.findOne({
          where: {
            foreignCurrencyId: userBaseCurrencyId
          }
        });
        sumOfAllOtherCurrenciesToUserBaseCurrencyAmount =
          sumOfAllOtherCurrenciesToBaseCurrencyAmount /
          userBaseCurrencyExchangeRate.baseCurrencyEquivalentAmount;
      } else {
        sumOfAllOtherCurrenciesToUserBaseCurrencyAmount =
          sumOfAllOtherCurrenciesToBaseCurrencyAmount;
      }

      for (const sumOfUserBaseCurrency of sumOfUserAllBaseCurrency) {
        sumOfAllOtherCurrenciesToUserBaseCurrencyAmount += Number(
          sumOfUserBaseCurrency?.dataValues['saving']
        );
      }

      return sumOfAllOtherCurrenciesToUserBaseCurrencyAmount;
    } catch (error) {
      this.logger.error('PaydaySavingService.getSumOfUserBaseCurrency - exception;', { error, sumOfAllOtherCurrencies, userBaseCurrencyId, sumOfUserAllBaseCurrency });
      throw new HttpException(
        error?.response ?? 'getSumOfUserBaseCurrency error ',
        error.status ?? HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  async getExchangeRateDefault(currencyId: string, paydayDate: Date = null) {
    this.logger.info('PaydaySavingService.getExchangeRateDefault - started', { currencyId, paydayDate });
    try {
      let exchangeRate = await this.currencyExchangeRate.findOne({
        where: {
          foreignCurrencyId: currencyId,
          exchangeDate: paydayDate
        }
      });
      if (exchangeRate === null) {
        exchangeRate = await this.currencyExchangeRate.findOne({
          where: {
            foreignCurrencyId: currencyId,
            exchangeDate: null
          }
        });
      }
      return exchangeRate;
    } catch (error) {
      this.logger.error('PaydaySavingService.getExchangeRateDefault - exception;', {
        error,
        currencyId,
        paydayDate
      });
      throw new HttpException(
        error?.response ?? 'getExchangeRateDefault error ',
        error.status ?? HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  async getExchangeRateToBaseCurrency(currencyId: string, paydayDate: Date = null) {
    let exchangeRate = await this.currencyExchangeRate.findOne({
      where: {
        foreignCurrencyId: currencyId,
        baseCurrencyId: '9ef4e24c-44b6-48a3-83f5-44f209d37554',
        exchangeDate: paydayDate
      }
    });
    if (exchangeRate === null) {
      exchangeRate = await this.currencyExchangeRate.findOne({
        where: {
          foreignCurrencyId: currencyId,
          baseCurrencyId: '9ef4e24c-44b6-48a3-83f5-44f209d37554',
          exchangeDate: null
        }
      });
    }
    return exchangeRate;
  }
}
