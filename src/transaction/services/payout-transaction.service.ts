import { BadRequestException, HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { PayoutTransaction } from '../entities/payout-transaction.model';
import { Op, Sequelize } from 'sequelize';
import { HttpStatusCode } from 'axios';
import { TransactionDetails } from '../responses/transaction-details.response';
import { Currency } from '../entities/currency.model';
import { PayoutTransactionStatus } from '../entities/payout-status.model';
import { ErrorMessages, ErrorStatusCodes } from 'src/common/errors/error-messages';
import { PayoutConfigurationService } from 'src/payout-configuration/services/payout-configuration.service';
import { ReceiptService } from './receipt.service';
import { Outlets } from '../entities/payout-merchant-outlet.model';
import { PayoutTransactionStatusEnum } from '../enums/payout-transaction-status.enum';
import { UploadReceiptImageDto } from '../dto/upload-receipt-image.dto';
import { Payout } from 'src/processed-payout/entities/payout.model';
import { PaydayReward } from '../entities/payday-rewards.model';
import { PaydaySavingService } from 'src/processed-payout/services/payday-saving.service';
import { PayoutStatusEnum } from '../enums/payout-status.enum';
import { ConfigService } from '@nestjs/config';
import { IInternalApis } from 'config/interface';
import { Group } from '../entities/payout-group.model';
import { GroupTransaction } from '../entities/group-transaction.model';
import { ConsumerCashback } from '../entities/consumer-cashback.model';
import { Consumer } from '../entities/consumer.model';
import { SubscriptionServiceProxy } from '../proxies/subscription-service.proxy';
import { CurrencyExchangeRate } from 'src/processed-payout/entities/currency-exchange-rate.model';
import { CustomPinoLogger } from 'src/logger/custom-logger.service';
import { baseResponseHelper } from 'src/common/helpers/base-response.helper';
import { BaseResponse } from 'src/common/dtos/base-response';
import { isValidDateFormat } from 'src/common/helpers/date.helper';
import { CmsServiceProxy } from '../proxies/cms-service.proxy';
import { ConsumerIdentityAdibServiceProxy } from '../proxies/consumer-identity-service.proxy';
import { CommonService } from 'src/common/service/common.service';
import { MerchantAdaptorServiceProxy } from '../proxies/merchant-adaptor-service.proxy';
import { TransactionQueryParams } from '../dto/get-transaction.dto';
import { CustomerPiiDataDto } from '../dto/customer-pii-data.dto';
import { ConsumerStatus } from '../enums/consumer-status.enum';
import { v4 as uuidv4 } from 'uuid';
import * as dayjs from 'dayjs';
import * as utc from 'dayjs/plugin/utc';
import * as timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);
import { EnvKeysEnum } from 'config/env.enum';

@Injectable()
export class PayoutTransactionService {
  private settlementStatusText: string;
  private mimojoProfileId: string;

  constructor(
    @InjectModel(PayoutTransaction)
    private readonly payoutTransaction: typeof PayoutTransaction,
    private readonly payoutConfigurationService: PayoutConfigurationService,
    private readonly receiptService: ReceiptService,
    private readonly paydaySavingService: PaydaySavingService,
    private readonly configService: ConfigService,
    private readonly subscriptionServiceProxy: SubscriptionServiceProxy,
    @InjectModel(CurrencyExchangeRate)
    private readonly currencyExchangeRate: typeof CurrencyExchangeRate,
    @InjectModel(Currency)
    private readonly currency: typeof Currency,
    private readonly logger: CustomPinoLogger,
    @InjectModel(PaydayReward)
    private readonly paydayReward: typeof PaydayReward,
    private readonly cmsProxy: CmsServiceProxy,
    private readonly consumerIdentityAdibProxy: ConsumerIdentityAdibServiceProxy,
    @InjectModel(Consumer)
    private readonly consumer: typeof Consumer,
    private readonly commonService: CommonService,
    private readonly merchantAdaptorServiceProxy: MerchantAdaptorServiceProxy
  ) {
    const { SETTLEMENT_STATUS, MIMOJO_PROFILE_ID } =
      this.configService.get<IInternalApis>('internal-apis');

    this.settlementStatusText = SETTLEMENT_STATUS;
    this.mimojoProfileId = MIMOJO_PROFILE_ID;
  }

  // ==========================================
  // V1 Logic Methods
  // ==========================================

  async getTransactionSummary(userId: string, preferredLanguage: string): Promise<any> {
    this.logger.info('PayoutTransactionService.getTransactionSummary - started', { userId });
    try {
      const formattedResult = {
        customerStatus: null,
        memberSince: null,
        totalLifetimeSavings: null,
        nextPaydaySavings: null,
        currency: 'AED'
      };

      const consumer = await this.findConsumer(userId);

      if (!consumer) {
        this.logger.warn('PayoutTransactionService.getTransactionSummary - customer not found');
        return baseResponseHelper(
          {},
          ErrorMessages.adib.customerNotFound.serverStatus,
          ErrorMessages.adib.customerNotFound.message
        );
      }

      const memberSince = await this.consumerIdentityAdibProxy.getMemberSince(userId);

      const consumerCurrency = await this.commonService.getCurrencyByCurrencyCode('AED');

      const consumerStatus = consumer?.isDeleted ? ConsumerStatus.INACTIVE : ConsumerStatus.ACTIVE;

      const currencyValue =
        preferredLanguage === 'ar'
          ? consumerCurrency?.currencyCodeAr
          : (consumerCurrency?.currencyCode ?? 'AED');

      const userCards = await this.cmsProxy.getUserCards(userId);
      if (userCards?.length === 0) {
        this.logger.error('PayoutTransactionService.getTransactionSummary - no user cards found', {
          userId
        });
        formattedResult.customerStatus = consumerStatus;
        formattedResult.memberSince = memberSince?.createdAt ?? null;
        formattedResult.totalLifetimeSavings = null;

        formattedResult.nextPaydaySavings = null;
        formattedResult.currency = currencyValue;
        return baseResponseHelper(formattedResult);
      }
      const userCardsIds = userCards.map((card) => card?.id);
      const sumResult = await this.getSchemeWiseNextPaydayTotalOnUserBaseCurrency(
        consumerCurrency?.currencyId,
        userCardsIds
      );

      const totalCashback = parseFloat(
        sumResult.reduce((sum, result) => sum + Number(result.totalCashback ?? 0), 0).toFixed(2)
      );

      let consumerTotalSaving = 0;

      const consumerSaving = await this.paydaySavingService.getConsumerLifetimeSavingByUserId(
        userId,
        consumerCurrency?.currencyId
      );

      if (consumerSaving) {
        consumerTotalSaving = consumerSaving.customerTotalSaving;
      }

      formattedResult.customerStatus = consumerStatus;
      formattedResult.memberSince = memberSince?.createdAt ?? null;
      formattedResult.totalLifetimeSavings = consumerTotalSaving
        ? Number(Number(consumerTotalSaving).toFixed(2))
        : 0.0;

      formattedResult.nextPaydaySavings = totalCashback ? Number(totalCashback.toFixed(2)) : 0.0;
      formattedResult.currency = currencyValue;
      return baseResponseHelper(formattedResult);
    } catch (error) {
      this.logger.error('PayoutTransactionService.getTransactionSummary - exception;', {
        error,
        userId
      });
      return baseResponseHelper(
        {},
        ErrorMessages.adib.genericError.serverStatus,
        ErrorMessages.adib.genericError.message
      );
    }
  }

  async getAllTransactionForUserCards(params: TransactionQueryParams): Promise<any> {
    const {
      userId,
      pageIndex,
      pageSize,
      fromDate,
      toDate,
      mimojoCardId,
      preferredLanguage,
      merchantPageSize
    } = params;
    this.logger.info('PayoutTransactionService.getAllTransactionForUserCards - started', {
      userId,
      pageIndex,
      pageSize,
      fromDate,
      mimojoCardId,
      preferredLanguage,
      merchantPageSize
    });
    try {
      const baseCurrency = await this.commonService.getCurrencyByCurrencyCode('AED');
      let userCardIds = null;
      let fromDateToUtc = null;
      let toDateToUtc = null;

      const consumer = await this.findConsumer(userId);

      if (!consumer) {
        this.logger.warn('PayoutTransactionService.getAllTransactionForUserCards - customer not found');
        return baseResponseHelper(
          {},
          ErrorMessages.adib.customerNotFound.serverStatus,
          ErrorMessages.adib.customerNotFound.message
        );
      }

      const userCards = await this.cmsProxy.getUserCards(userId);

      if (userCards?.length) {
        if (mimojoCardId) {
          userCardIds = userCards
          .filter(card => card?.id === mimojoCardId)
          .map(card => card.id);
        } else {
          userCardIds = userCards.map((card) => card.id);
        }
      }
      if (fromDate) {
        fromDateToUtc = dayjs.tz(fromDate, 'Asia/Dubai').utc().toISOString();
      }
      if (toDate) {
        toDateToUtc = dayjs.tz(toDate, 'Asia/Dubai').utc().toISOString();
      }
      const sumResult = await this.getotalExcludingFailedOnUserBaseCurrency(
        baseCurrency?.currencyId,
        userCardIds,
        fromDateToUtc,
        toDateToUtc
      );

      const totalCashback = sumResult.reduce((sum, result) => {
        return sum + Number(result.totalCashback ?? 0);
      }, 0);
      const nextPaydayDate = await this.getConditionalNextPaydayDate(totalCashback);

      const result = await this.getAllPayoutTransactionForUserCards(
        pageIndex,
        pageSize,
        userCardIds,
        fromDateToUtc,
        toDateToUtc
      );

      const formattedResult = [];
      for (const transaction of result.rows) {
        const transactionData = this.formatTransactionData(
          transaction,
          preferredLanguage,
          baseCurrency,
          totalCashback,
          nextPaydayDate
        );
        formattedResult.push(transactionData);
      }

      let response;
      if (merchantPageSize) {
        const merchants = await this.merchantAdaptorServiceProxy.getMerchants(merchantPageSize);
        response = {
          transactions: formattedResult,
          merchants
        };
      } else {
        response = {
          transactions: formattedResult,
          pagination: {
            page: pageIndex,
            pageCount: Math.ceil(result.count / pageSize),
            total: result.count,
            count: result.rows.length
          }
        };
      }

      return baseResponseHelper(response);
    } catch (error) {
      this.logger.error('PayoutTransactionService.getAllTransactionForUserCards - exception;', {
        error,
        userId,
        merchantPageSize,
        mimojoCardId
      });
      return baseResponseHelper(
        {},
        ErrorMessages.adib.genericError.serverStatus,
        ErrorMessages.adib.genericError.message
      );
    }
  }

  private formatTransactionData(
    transaction: any,
    preferredLanguage: string,
    baseCurrency: any,
    totalCashback: number,
    nextPaydayDate: Date
  ) {
    const merchantName = this.getMerchantName(transaction, preferredLanguage);
    const currencyValue =
      preferredLanguage === 'ar'
        ? baseCurrency?.currencyCodeAr
        : (baseCurrency?.currencyCode ?? 'AED');
    const status =
      preferredLanguage === 'ar'
        ? transaction.dataValues.payoutTransactionStatus.displayNameAr
        : transaction.dataValues.payoutTransactionStatus.displayName;
    const transactionData = this.getFormattedUserCardTransactionData(
      transaction,
      merchantName,
      status,
      nextPaydayDate,
      totalCashback,
      currencyValue
    );
    return transactionData;
  }

  async getAllCardsForCustomer(consumerId: string, preferredLanguage: string): Promise<any> {
    this.logger.info("PayoutTransactionService.getAllCardsForCustomer - starts", {consumerId, preferredLanguage});
    const profileId = process.env[EnvKeysEnum.ADIB_PROFILE_ID];
    try {
      const customer = await this.consumer.findOne({
        where: {
          consumerId,
          profileIds: {
            [Op.contains]: [profileId]
          }
        }
      });

      if (!customer) {
        this.logger.warn("PayoutTransactionService.getAllCardsForCustomer - customer not found");
        return baseResponseHelper(
          {},
          ErrorMessages.adib.customerNotFound.serverStatus,
          ErrorMessages.adib.customerNotFound.message
        );
      }

      const cards = await this.cmsProxy.getUserCards(consumerId);
      if (cards?.length === 0) {
        return baseResponseHelper({});
      }
      const cardIds = cards?.length ? cards.map((c) => c?.id).filter(Boolean) : [];

      const totalSavingsOnCard =
        cardIds.length > 0 ? await this.paydaySavingService.getCardWiseTotalSaving(cardIds) : [];

      const savingsMap = new Map<string, number>(
        (totalSavingsOnCard ?? []).map((entry) => [entry?.cardId, entry?.saving])
      );

      const consumerCurrency = await this.commonService.getCurrencyByCurrencyCode('AED');

      const currencyValue =
        preferredLanguage === 'ar'
          ? consumerCurrency?.currencyCodeAr
          : (consumerCurrency?.currencyCode ?? 'AED');

      const enrollCards = this.formatEnrolledCards(cards, savingsMap, currencyValue);
      return baseResponseHelper({ data: { enrollCards } }, HttpStatus.OK, 'Success');
    } catch (error) {
      this.logger.error('PayoutTransactionService.getAllCardsForCustomer - exception;', {
        error,
        consumerId
      });

      return baseResponseHelper(
        {},
        ErrorMessages.adib.genericError.serverStatus,
        ErrorMessages.adib.genericError.message
      );
    }
  }

  private formatEnrolledCards(
    cards: any[],
    savingsMap: Map<string, number>,
    currencyValue: string
  ): any[] {
    return (cards ?? []).map((card) => ({
      mimojoCardId: card?.id ?? null,
      cardLast4: card?.cardLast4 ?? null,
      cardStatus: card?.status ?? null,
      totalSavingsOnCard: savingsMap.get(card?.id) ?? 0,
      currency: currencyValue
    }));
  }

  async getPaydayTransactionByIdAndUserId(payoutTransactionId: string): Promise<any> {
    this.logger.info('PayoutTransactionService.getPaydayTransactionByIdAndUserId - started', {
      payoutTransactionId
    });
    try {
      const result = await this.payoutTransaction.findOne({
        attributes: this.getSelectAttribute(),
        where: {
          payoutTransactionId: payoutTransactionId,
          profileId: process.env[EnvKeysEnum.ADIB_PROFILE_ID]
        },
        include: [
          { model: PayoutTransactionStatus, as: 'payoutTransactionStatus' },
          { model: Currency, as: 'currency' },
          { model: Outlets, as: 'outlets' },
          { model: Group, as: 'groups', required: false },
          { model: GroupTransaction, as: 'groupTransactions', required: false },
          {
            model: ConsumerCashback,
            as: 'consumerCashbacks',
            required: false,
            include: [{ model: Consumer, as: 'recipient', required: false }]
          }
        ]
      });
      if (result) {
        return result;
      }
      return null;
    } catch (error) {
      this.logger.error('PayoutTransactionService.getPaydayTransactionByIdAndUserId - exception;', {
        error,
        payoutTransactionId
      });
      throw error;
    }
  }

  async appeal(id: string, image: any, note: string, userId: string) {
    this.logger.info('PayoutTransactionService.appeal - started', { id, image, note, userId });
    try {
      const customer = await this.findConsumer(userId);
      this.logger.info('PayoutTransactionService.appeal - customer found', { customer });
      if (!customer) {
        return baseResponseHelper(
          {},
          ErrorMessages.adib.customerNotFound.serverStatus,
          ErrorMessages.adib.customerNotFound.message
        );
      }

      const transaction = await this.getPaydayTransactionByIdAndUserId(id);
      this.logger.info('PayoutTransactionService.appeal - transaction found', { transaction });
      if (!transaction) {
        return baseResponseHelper(
          {},
          ErrorMessages.adib.transactionNotFound.serverStatus,
          ErrorMessages.adib.transactionNotFound.message
        );
      }

      const appealResponse = await this.receiptService.appealOnTransaction(
        id,
        image,
        note
      );
      this.logger.info('PayoutTransactionService.appeal - appeal response', { appealResponse });
      if (appealResponse?.success?.isSuccess === true || appealResponse?.success) {
        return baseResponseHelper({}, HttpStatus.OK, 'Success');
      }
    } catch (error) {
      this.logger.error('PayoutTransactionService.appeal - exception;', {
        error,
        userId,
        trasactionId: id
      });
      return baseResponseHelper(
        {},
        ErrorMessages.adib.genericError.serverStatus,
        ErrorMessages.adib.genericError.message
      );
    }
  }

  private getMerchantName(transaction: any, preferredLanguage: string | null) {
    let merchantName = null;
    if (preferredLanguage === 'ar') {
      if (transaction.dataValues['merchantName'])
        merchantName =
          transaction.dataValues['merchantNameAr'] ?? transaction.dataValues['merchantName'];
      else
        merchantName =
          transaction.dataValues['groupNameAr'] ?? transaction.dataValues['groupName'] ?? null;
    } else {
      merchantName =
        transaction.dataValues['merchantName'] ?? transaction.dataValues['groupName'] ?? null;
    }
    return merchantName;
  }

  private getSelectAttributeForUserCards(): any[] {
    return [
      'payoutTransactionId',
      ['transaction_timestamp', 'transactionDate'],
      'transactionAmount',
      'cashbackAmount',
      ['card_last_4_digit', 'cardLast4Digit'],
      [Sequelize.col('outlets.merchant_logo'), 'merchantLogo'],
      [Sequelize.col('outlets.merchant_name'), 'merchantName'],
      'receipt',
      'cardScheme'
    ];
  }

  private getFormattedUserCardTransactionData(
    transaction: PayoutTransaction,
    merchantName: string,
    status: string,
    nextPaydayDate: Date,
    totalCashback: number,
    currencyValue: string
  ) {
    return {
      transactionId: transaction.payoutTransactionId,
      merchantLogo: transaction.dataValues['merchantLogo'] ?? null,
      merchantName: merchantName,
      transactionAmount: Number(transaction.transactionAmount).toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }),
      cashbackAmount: Number(transaction.cashbackAmount).toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }),
      paydaySavingAmount:
        Number(totalCashback) !== 0
          ? Number(totalCashback).toLocaleString('en-US', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2
            })
          : null,
      currency: currencyValue,
      cardLast4Digits: transaction.cardLast4Digit,
      transactionDate: transaction.dataValues['transactionDate'],
      paydayDate: nextPaydayDate,
      transactionStatus: status,
      receipt: this.receiptService.getReceiptImageUrl(transaction.receipt)
    };
  }

  private async getotalExcludingFailedOnUserBaseCurrency(
    userBaseCurrencyId: string,
    userCards: string[] | null,
    fromDate: string | null,
    toDate: string | null
  ) {
    if (userCards === null || userCards.length === 0) {
      return [];
    }
    try {
      const whereClause: any = {
        payoutTransactionStatusId: {
          [Op.in]: [
            PayoutTransactionStatusEnum.Approved,
            PayoutTransactionStatusEnum.NoSaving,
          ],
        },
        isProcessed: true,
        profileId: process.env[EnvKeysEnum.ADIB_PROFILE_ID],
        currencyId: userBaseCurrencyId,
        isRewardCredited: {
          [Op.or]: [false, null],
        },
        transactionCardId: { [Op.in]: userCards }
      };

      if (fromDate && toDate) {
        whereClause.transactionTimestamp = {
          [Op.between]: [fromDate, toDate]
        };
      } else if (fromDate) {
        whereClause.transactionTimestamp = {
          [Op.gte]: fromDate
        };
      } else if (toDate) {
        whereClause.transactionTimestamp = {
          [Op.lte]: toDate
        };
      }

      const nextPaydaySavings = await this.payoutTransaction.findAll({
        attributes: [
          'currencyId',
          'cardScheme',
          [Sequelize.fn('SUM', Sequelize.col('cashback_amount')), 'totalCashback']
        ],
        include: {
          model: Payout,
          attributes: [],
          where: {
            payoutStatusId: { [Op.ne]: PayoutStatusEnum.DisbursementFailed }
          }
        },
        where: whereClause,
        group: ['currencyId', 'cardScheme']
      });

      const retValue: any[] = [];
      const sumOfUserAllBaseCurrencyVisa = nextPaydaySavings.filter(
        (p) => p.currencyId === userBaseCurrencyId && p.cardScheme === 'visa'
      );
      retValue.push(
        this.getSumOfUsersBaseCurrency(userBaseCurrencyId, sumOfUserAllBaseCurrencyVisa, 'visa')
      );
      const sumOfUserAllBaseCurrencyMastercard = nextPaydaySavings.filter(
        (p) => p.currencyId === userBaseCurrencyId && p.cardScheme === 'mastercard'
      );
      retValue.push(
        this.getSumOfUsersBaseCurrency(
          userBaseCurrencyId,
          sumOfUserAllBaseCurrencyMastercard,
          'mastercard'
        )
      );
      return retValue;
    } catch (error) {
      this.logger.error(
        'PayoutTransactionService.getotalExcludingFailedOnUserBaseCurrency - exception;',
        { error, userBaseCurrencyId, userCards, fromDate, toDate }
      );
      throw error;
    }
  }

  private async getSchemeWiseNextPaydayTotalOnUserBaseCurrency(
    userBaseCurrencyId: string,
    cardIds?: string[]
  ) {
    try {
      const retValue: any[] = [];
      const savingGroupByCurrencyCard = await this.payoutTransaction.findAll({
        attributes: [
          'cardScheme',
          'currencyId',
          [Sequelize.fn('SUM', Sequelize.col('cashback_amount')), 'totalCashback']
        ],
        where: {
          transactionCardId: { [Op.in]: cardIds },
          [Op.or]: [{ isRewardCredited: false }, { isRewardCredited: null }],
          payoutTransactionStatusId: PayoutTransactionStatusEnum.Approved,
          isProcessed: true,
          profileId: process.env[EnvKeysEnum.ADIB_PROFILE_ID]
        },
        group: ['cardScheme', 'currencyId']
      });

      const sumOfUserAllBaseCurrencyVisa = savingGroupByCurrencyCard.filter(
        (p) => p.currencyId === userBaseCurrencyId && p.cardScheme === 'visa'
      );
      retValue.push(
        this.getSumOfUsersBaseCurrency(userBaseCurrencyId, sumOfUserAllBaseCurrencyVisa, 'visa')
      );
      const sumOfUserAllBaseCurrencyMastercard = savingGroupByCurrencyCard.filter(
        (p) => p.currencyId === userBaseCurrencyId && p.cardScheme === 'mastercard'
      );
      retValue.push(
        this.getSumOfUsersBaseCurrency(
          userBaseCurrencyId,
          sumOfUserAllBaseCurrencyMastercard,
          'mastercard'
        )
      );
      return retValue;
    } catch (error) {
      this.logger.error(
        'PayoutTransactionService.getSchemeWiseNextPaydayTotalOnUserBaseCurrency - exception;',
        { error, userBaseCurrencyId, cardIds }
      );
      throw error;
    }
  }

  private getSumOfUsersBaseCurrency(
    userBaseCurrencyId: string,
    sumOfUserAllBaseCurrency: PayoutTransaction[],
    cardScheme: string
  ) {
    let sumOfAllOtherCurrenciesToUserBaseCurrencyAmount = 0;
    for (const sumOfUserBaseCurrency of sumOfUserAllBaseCurrency) {
      const cashback = Number(sumOfUserBaseCurrency?.dataValues?.['totalCashback'] ?? 0);
      sumOfAllOtherCurrenciesToUserBaseCurrencyAmount += isNaN(cashback) ? 0 : cashback;
    }

    return {
      cardScheme: cardScheme,
      totalCashback: sumOfAllOtherCurrenciesToUserBaseCurrencyAmount,
      currencyId: userBaseCurrencyId
    };
  }

  private async getConditionalNextPaydayDate(totalCashback: number) {
    try {
      let nextPaydayResponse = null;
      if (totalCashback == 0)
        nextPaydayResponse = await this.payoutConfigurationService.getNextPaydayDatePlusOneDay();
      else nextPaydayResponse = await this.payoutConfigurationService.getNextPaydayDate();

      const nextPaydayDate = new Date(nextPaydayResponse.data);
      return nextPaydayDate;
    } catch (error) {
      this.logger.error('PayoutTransactionService.getConditionalNextPaydayDate - exception;', {
        error,
        totalCashback
      });
      throw error;
    }
  }

  private async getAllPayoutTransactionForUserCards(
    pageIndex: number,
    pageSize: number,
    userCardIds: string[] | null,
    fromDate: string | null,
    toDate: string | null
  ) {
    if (userCardIds === null || userCardIds.length === 0) {
      return { rows: [], count: 0};
    }
    try {
      const whereClause: any = {
        profileId: process.env[EnvKeysEnum.ADIB_PROFILE_ID],
        transactionCardId: { [Op.in]: userCardIds }
      };

      if (fromDate && toDate) {
        whereClause.transactionTimestamp = {
          [Op.between]: [fromDate, toDate]
        };
      } else if (fromDate) {
        whereClause.transactionTimestamp = {
          [Op.gte]: fromDate
        };
      } else if (toDate) {
        whereClause.transactionTimestamp = {
          [Op.lte]: toDate
        };
      }

      const result = await this.payoutTransaction.findAndCountAll({
        offset: pageIndex * pageSize,
        limit: pageSize,
        attributes: this.getSelectAttributeForUserCards(),
        where: whereClause,
        include: [
          { model: PayoutTransactionStatus, as: 'payoutTransactionStatus' },
          { model: Currency, as: 'currency' },
          { model: Outlets, as: 'outlets' },
          { model: Group, as: 'groups', required: false },
          { model: GroupTransaction, as: 'groupTransactions', required: false },
          {
            model: ConsumerCashback,
            as: 'consumerCashbacks',
            required: false,
            include: [{ model: Consumer, as: 'recipient', required: false }]
          },
          { model: Payout, required: false }
        ],
        order: [['transaction_timestamp', 'DESC']]
      });

      return result;
    } catch (error) {
      this.logger.error(
        'PayoutTransactionService.getAllPayoutTransactionForUserCards - exception;',
        { error, pageIndex, pageSize, userCardIds, fromDate, toDate }
      );
      throw error;
    }
  }

  private async findConsumer(consumerId: string) {
    const profileId = process.env[EnvKeysEnum.ADIB_PROFILE_ID];
    try {
      const response = await this.consumer.findOne({
        where: {
          consumerId,
          profileIds: {
            [Op.contains]: [profileId]
          }
        },
        raw: true
      });
      return response;
    } catch (ex) {
      this.logger.error('PayoutTransactionService.findConsumer - exception;', {
        error: ex,
        consumerId
      });
      throw ex;
    }
  }

  async updateCustomerPiiDetails(consumerId: string, body: CustomerPiiDataDto) {
    this.logger.info("PayoutTransactionService.updateCustomerPiiDetails - starts", {consumerId});
    const traceId = uuidv4();
    try {
      const profileId = process.env[EnvKeysEnum.ADIB_PROFILE_ID];
      
      const consumer = await this.consumer.findOne({
        where: {
          consumerId,
          profileIds: {
            [Op.contains]: [profileId]
          }
        }
      });

      if (!consumer) {
        this.logger.info("PayoutTransactionService.updateCustomerPiiDetails - customer not found");
        return baseResponseHelper(
          {},
          ErrorMessages.adib.customerNotFound.serverStatus,
          ErrorMessages.adib.customerNotFound.message
        );
      }

      if (body.dateOfBirth) {
        body.dateOfBirth = new Date(body.dateOfBirth).toISOString();
      }

      await this.consumer.update(
        {
          mobile: body.mobile,
          firstName: body.firstName,
          lastName: body.lastName,
          email: body.email,
          gender: body.gender,
          dateOfBirth: body.dateOfBirth,
          nationality: body.nationality
        },
        { where: { consumerId } }
      );

      return baseResponseHelper({}, traceId);
    } catch (error) {
      this.logger.error('PayoutTransactionService.updateCustomerPiiDetails - exception;', {
        error,
        consumerId
      });
      return baseResponseHelper(
        {},
        ErrorMessages.adib.genericError.serverStatus,
        ErrorMessages.adib.genericError.message
      );
    }
  }

  // ==========================================
  // V2 Logic Methods
  // ==========================================

  async getTransactionDetailsV2(
    id: string,
    preferredLanguage: string
  ): Promise<TransactionDetails> {
    if (id) {
      const payoutTransaction = await this.payoutTransaction.findOne({
        attributes: this.getSelectAttribute(),
        where: { payoutTransactionId: id },
        include: this.getIncludeForTransactionDetails()
      });
      if (!payoutTransaction)
        throw new HttpException(ErrorMessages.transaction.notFound, HttpStatus.NOT_FOUND);

      const status = payoutTransaction.payoutTransactionStatus?.displayName;
      const transactionDetails = await this.getFormattedTransactionDetails(
        payoutTransaction,
        status,
        preferredLanguage
      );
      return transactionDetails;
    }
  }

  async getTransactionSummaryV2(userId: any, preferredLanguage: string): Promise<any> {
    const formattedResult = {
      nextPayDate: null,
      nextPayDateVisa: null,
      nextPayDateMasterCard: null,
      totalSaving: '0.00',
      totalCashbackCurrency: '',
      nextPaydaySavingVisa: '0.00',
      nextPaydaySavingMasterCard: '0.00',
      nextPaydaySaving: '0.00',
      nextPaydayCurrency: '',
      cardWiseSavings: []
    };

    const consumerCurrency = await this.getConsumerHomeCurrency(userId);

    if (!consumerCurrency?.data?.data?.subscribedCurrency) {
      throw new HttpException(
        ErrorMessages.scheme.currencyNotFound,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
    const sumResult = await this.getSchemeWiseNextPaydayTotalOnUserBaseCurrencyV2(
      userId,
      consumerCurrency?.data?.data?.subscribedCurrency
    );
    let visaTotalCashback = 0,
      mastercardTotalCashback = 0;

    if (sumResult?.find((p) => p.cardScheme.toLowerCase() === 'visa')) {
      visaTotalCashback = Number(
        sumResult?.find((p) => p.cardScheme.toLowerCase() === 'visa')['totalCashback']
      );
    }
    if (sumResult?.find((p) => p.cardScheme.toLowerCase() === 'mastercard')) {
      mastercardTotalCashback = Number(
        sumResult?.find((p) => p.cardScheme.toLowerCase() === 'mastercard')['totalCashback']
      );
    }
    const totalCashback =
      Number(visaTotalCashback.toFixed(2)) + Number(mastercardTotalCashback.toFixed(2));

    let consumerTotalSaving = 0;
    let currencyCode = null;

    const consumerSaving = await this.paydaySavingService.getConsumerLifetimeSavingByUserId(
      userId,
      consumerCurrency?.data?.data?.subscribedCurrency
    );

    if (consumerSaving) {
      consumerTotalSaving = consumerSaving?.customerTotalSaving;
      currencyCode = consumerSaving?.currencyCode;
    }

    const baseCurrency = await this.getCurrencyCodeByCurrencyId(
      consumerCurrency?.data?.data?.subscribedCurrency
    );
    const cardWiseSaving = await this.paydaySavingService.getCardWiseTotalSavingByUser(
      userId,
      consumerCurrency?.data?.data?.subscribedCurrency,
      baseCurrency,
      preferredLanguage
    );
    let nextPaydayResponse = null;
    if (totalCashback == 0)
      nextPaydayResponse = await this.payoutConfigurationService.getNextPaydayDatePlusOneDay();
    else nextPaydayResponse = await this.payoutConfigurationService.getNextPaydayDate();

    const date = new Date(nextPaydayResponse.data);

    formattedResult.nextPayDate = date;
    formattedResult.nextPayDateVisa = date;
    formattedResult.nextPayDateMasterCard = date;
    formattedResult.totalSaving = consumerTotalSaving
      ? Number(consumerTotalSaving).toLocaleString('en-US', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2
        })
      : '0.00';
    formattedResult.totalCashbackCurrency =
      preferredLanguage === 'ar' ? baseCurrency?.currencyCodeAr : baseCurrency?.currencyCode;
    formattedResult.nextPaydayCurrency =
      preferredLanguage === 'ar' ? baseCurrency?.currencyCodeAr : baseCurrency?.currencyCode;
    formattedResult.nextPaydaySavingVisa = visaTotalCashback.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
    formattedResult.nextPaydaySavingMasterCard = mastercardTotalCashback.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
    formattedResult.nextPaydaySaving = totalCashback.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
    formattedResult.cardWiseSavings = cardWiseSaving;

    return formattedResult;
  }

  async getNextPaydayTransactionV2(
    userId: any,
    pageIndex: number,
    pageSize: number,
    preferredLanguage: string
  ): Promise<any> {
    let result = null;
    const baseCurrency = await this.getConsumerBaseCurrency(userId);
    if (!baseCurrency) {
      return null;
    }
    const sumResult = await this.getNextPaydayTotalExcludingFailedOnUserBaseCurrency(
      userId,
      baseCurrency?.currencyId
    );
    const totalCashback = Number(sumResult.totalCashback);
    const nextPaydayDate = await this.getConditionalNextPaydayDateV2(totalCashback);

    if (Number.isNaN(Number(pageIndex)) || Number.isNaN(Number(pageSize))) {
      result = await this.getPayoutTransactionWithoutPaging(result, userId, nextPaydayDate);
    } else {
      result = await this.getPayoutTransactionWithPaging(
        result,
        pageIndex,
        pageSize,
        userId,
        nextPaydayDate
      );
    }

    const formattedResult = [];
    for (const transaction of result.rows) {
      const { outletName, recipientName } = this.getOutletName(transaction, preferredLanguage);
      const status = transaction.dataValues['status'];
      const transactionData = this.getFormattedTransactionDataV2(
        transaction,
        outletName,
        status,
        nextPaydayDate,
        totalCashback,
        baseCurrency,
        preferredLanguage
      );
      formattedResult.push(transactionData);
    }

    return {
      data: formattedResult,
      pagination: {
        page: pageIndex,
        pageCount: Math.ceil(result.count / pageSize),
        total: result.count,
        count: result.rows.length
      }
    };
  }

  private async getConsumerBaseCurrency(userId: any) {
    const consumerCurrency = await this.getConsumerHomeCurrency(userId);
    if (!consumerCurrency?.data?.data?.subscribedCurrency) {
      return null;
    }
    return await this.getCurrencyCodeByCurrencyId(consumerCurrency?.data?.data?.subscribedCurrency);
  }

  private async getCurrencyCodeByCurrencyId(currencyId: string) {
    const currencyCode = await this.currency.findOne({
      where: {
        currencyId: currencyId
      }
    });
    return currencyCode;
  }

  async getAllPaydayTransactionV2(
    userId: any,
    pageIndex: number,
    pageSize: number,
    preferredLanguage: string
  ): Promise<any> {
    let result = null;

    const baseCurrency = await this.getConsumerBaseCurrency(userId);
    const sumResult = await this.getNextPaydayTotal(userId);
    const totalCashback = Number(sumResult.get('totalCashback'));
    const nextPaydayDate = await this.getConditionalNextPaydayDateV2(totalCashback);

    const order: any = [[Sequelize.col('payout.payday_date'), 'DESC']];
    const include: any = this.getIncludeForAllPaydayTransaction();

    if (Number.isNaN(Number(pageIndex)) || Number.isNaN(Number(pageSize))) {
      result = await this.getPayoutProcessedTransactionWithoutPaging(
        userId,
        nextPaydayDate,
        include,
        order
      );
    } else {
      result = await this.getPayoutProcessedTransactionWithPaging(
        pageIndex,
        pageSize,
        userId,
        nextPaydayDate,
        include,
        order
      );
    }

    const paydayDates = result.rows.map((transaction) => transaction.dataValues['paydayDate']);

    const rewards = await PaydayReward.findAll({
      attributes: [
        'paydayDate',
        [Sequelize.fn('SUM', Sequelize.col('reward_amount')), 'rewardAmount']
      ],
      where: {
        paydayDate: paydayDates,
        consumerId: userId,
        rewardStatusId: 2 //Reward Success
      },
      group: ['paydayDate']
    });

    const rewardsMap = new Map<string, number>(
      rewards.map((reward) => [reward.paydayDate.toString(), Number(reward.rewardAmount)])
    );

    const formattedResult = [];
    for (const transaction of result.rows) {
      const status = transaction.dataValues['transactionStatus'];
      const { outletName, recipientName } = this.getOutletName(transaction, preferredLanguage);
      const transactionData = this.getFormattedAllTransactionData(
        transaction,
        outletName,
        status,
        rewardsMap,
        baseCurrency,
        preferredLanguage
      );
      formattedResult.push(transactionData);
    }

    return {
      data: formattedResult,
      pagination: {
        page: pageIndex,
        pageCount: Math.ceil(result.count / pageSize),
        total: result.count,
        count: result.rows.length
      }
    };
  }

  async getPaydayTransactionByIdV2(
    payoutTransactionId: string,
    preferredLanguage: string
  ): Promise<any> {
    const result = await this.payoutTransaction.findOne({
      attributes: this.getSelectAttribute(),
      where: {
        payoutTransactionId: payoutTransactionId
      },
      include: [
        { model: PayoutTransactionStatus, as: 'payoutTransactionStatus' },
        { model: Currency, as: 'currency' },
        { model: Outlets, as: 'outlets' },
        { model: Group, as: 'groups', required: false },
        { model: GroupTransaction, as: 'groupTransactions', required: false },
        {
          model: ConsumerCashback,
          as: 'consumerCashbacks',
          required: false,
          include: [{ model: Consumer, as: 'recipient', required: false }]
        }
      ]
    });
    const response = await this.payoutConfigurationService.getNextPaydayDate();
    const transaction = result;
    const status = transaction.dataValues['status'];

    const transactionData = this.getFomattedTransactionById(
      transaction,
      status,
      response,
      preferredLanguage
    );
    return transactionData;
  }

  async appealV2(id: string, image: any, note: string, preferredLanguage: string) {
    if (image && !(await this.isImageFile(image))) {
      throw new BadRequestException('Invalid file type. Only image files are allowed.');
    }
    const appealResponse = await this.receiptService.appealOnTransaction(id, image, note);
    const payoutTransactionResponse = await this.getPaydayTransactionByIdV2(id, preferredLanguage);
    if (appealResponse?.success?.isSuccess === true || appealResponse?.success) {
      return {
        ...payoutTransactionResponse
      };
    } else {
      throw new HttpException('Appeal request failed!', HttpStatusCode.BadRequest);
    }
  }

  async uploadReceiptV2(
    uploadReceiptImage: UploadReceiptImageDto,
    image: Express.Multer.File,
    preferredLanguage: string
  ) {
    if (!(await this.isImageFile(image))) {
      throw new BadRequestException('Invalid file type. Only image files are allowed.');
    }
    const uploadResponse = await this.receiptService.uploadReceiptTransaction(
      uploadReceiptImage,
      image
    );
    const payoutTransactionResponse = await this.getPaydayTransactionByIdV2(
      uploadReceiptImage.id,
      preferredLanguage
    );
    return {
      ...payoutTransactionResponse
    };
  }

  private getSelectAttributeForProcessedTransaction(): any[] {
    return [
      [Sequelize.col('payout.payout_transaction_id'), 'transactionId'],
      [Sequelize.col('PayoutTransaction.transaction_timestamp'), 'transactionDate'],
      [Sequelize.col('card_scheme'), 'cardScheme'],
      [Sequelize.col('outlets.outlet_name'), 'outletName'],
      [Sequelize.col('outlets.outlet_name_ar'), 'outletNameAr'],
      [Sequelize.col('outlets.category_logo'), 'categoryLogo'],
      [
        Sequelize.cast(Sequelize.col('PayoutTransaction.cashback_amount'), 'DECIMAL(10,2)'),
        'cashbackAmount'
      ],
      [Sequelize.col('payoutTransactionStatus.display_name'), 'transactionStatus'],
      [Sequelize.col('payoutTransactionStatus.display_name_ar'), 'transactionStatusAr'],
      [Sequelize.col('currency.currency_code'), 'currencyCode'],
      [Sequelize.col('currency.currency_code_ar'), 'currencyNameAr'],
      [Sequelize.col('receipt'), 'receipt'],
      [Sequelize.col('payout.payday_date'), 'paydayDate'],
      [Sequelize.col('is_appealed'), 'isAppealed'],
      [Sequelize.col('consumerCashbacks->recipient.nick_name'), 'recipientNickName'],
      [Sequelize.col('consumerCashbacks->recipient.consumer_id'), 'recipientConsumerId'],
      [
        Sequelize.col('payoutTransactionStatus.payout_transaction_status_id'),
        'transactionStatusId'
      ],
      'consumerCashbackId',
      'source'
    ];
  }

  private async getFormattedTransactionDetails(
    payoutTransaction: PayoutTransaction,
    status: string,
    preferredLanguage: string
  ): Promise<TransactionDetails> {
    const transactionDetails = new TransactionDetails();
    let receiptUrl = this.receiptService.getReceiptImageUrl(
      payoutTransaction.dataValues['receipt']
    );
    const { outletName, recipientName } = this.getOutletName(payoutTransaction, preferredLanguage);
    transactionDetails.id = payoutTransaction.payoutTransactionId;
    transactionDetails.outletName = outletName;
    transactionDetails.transactionCurrency =
      preferredLanguage === 'ar'
        ? payoutTransaction.dataValues['currencyNameAr']
        : payoutTransaction.dataValues['currencyName'];
    transactionDetails.transactionStatus = status;
    transactionDetails.receiptImageUrl = receiptUrl;
    transactionDetails.transactionDate = payoutTransaction.dataValues['transactionDate'];
    transactionDetails.transactionSavingAmount = Number(
      payoutTransaction.dataValues['cashbackAmount']
    ).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    transactionDetails.amountSpentOnTransaction = Number(
      payoutTransaction.dataValues['transactionAmount']
    ).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    transactionDetails.merchantImage = payoutTransaction.dataValues['merchantLogo']
      ? payoutTransaction.dataValues['merchantLogo']
      : payoutTransaction.dataValues['groupLogo'];
    transactionDetails.categoryImage = payoutTransaction.dataValues['categoryLogo']
      ? payoutTransaction.dataValues['categoryLogo']
      : payoutTransaction.dataValues['groupCategoryLogo'];
    transactionDetails.isAppealed = payoutTransaction.dataValues['isAppealed'];
    transactionDetails.cardScheme = payoutTransaction.dataValues['cardScheme'];
    transactionDetails.settlementStatus =
      payoutTransaction.dataValues['groupTransactionStatusId'] === 1
        ? this.settlementStatusText
        : null;
    transactionDetails.isSchemeTransaction =
      payoutTransaction.dataValues['consumerCashbackId'] == null;
    transactionDetails.recipientName = payoutTransaction.dataValues['recipientNickName'];
    transactionDetails.recipientSubscriptionDate =
      await this.getSubscriptionDateByConsumerId(payoutTransaction);
    transactionDetails.source = payoutTransaction.source;

    return transactionDetails;
  }

  private async getSubscriptionDateByConsumerId(payoutTransaction: any) {
    const consumerId =
      payoutTransaction.dataValues['recipientConsumerId'] ??
      payoutTransaction.dataValues['donorConsumerId'];
    if (payoutTransaction.dataValues['consumerCashbackId'] != null) {
      const response =
        await this.subscriptionServiceProxy.getSubscriptionDateByConsumerId(consumerId);
      return response?.data?.data?.createdAt;
    }
  }

  private getIncludeForTransactionDetails() {
    return [
      {
        model: Currency,
        required: false
      },
      {
        model: PayoutTransactionStatus,
        required: false
      },
      {
        model: Outlets,
        required: false
      },
      {
        model: GroupTransaction,
        required: false
      },
      {
        model: Group,
        required: false
      },
      {
        attributes: [],
        model: ConsumerCashback,
        as: 'consumerCashbacks',
        required: false,
        include: [
          {
            model: Consumer,
            required: false,
            as: 'recipient'
          }
        ]
      }
    ];
  }

  private getFormattedAllTransactionData(
    transaction: PayoutTransaction,
    outletName: any,
    status: any,
    rewardsMap: Map<string, number>,
    userBaseCurrency: Currency,
    preferredLanguage: string
  ) {
    return {
      transactionId: transaction.dataValues['transactionId'],
      categoryImage: transaction.dataValues['categoryLogo'],
      outletName: outletName,
      cashbackAmount: Number(transaction.dataValues['cashbackAmount']).toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }),
      currency:
        preferredLanguage === 'ar'
          ? transaction?.dataValues['currencyCodeAr']
          : transaction?.dataValues['currencyCode'],
      transactionDate: transaction.dataValues['transactionDate'],
      transactionStatus: status,
      receipt: this.receiptService.getReceiptImageUrl(transaction.dataValues['receipt']),
      paydayDate: transaction.dataValues['paydayDate'],
      paydaySavingAmount: rewardsMap.get(transaction.dataValues['paydayDate'].toString())
        ? Number(rewardsMap.get(transaction.dataValues['paydayDate'].toString())).toLocaleString(
            'en-US',
            { minimumFractionDigits: 2, maximumFractionDigits: 2 }
          )
        : '0.00',
      paydaySavingAmountCurrency:
        preferredLanguage === 'ar'
          ? userBaseCurrency.currencyCodeAr
          : userBaseCurrency.currencyCode,
      cardScheme: transaction.dataValues['cardScheme'],
      isSchemeTransaction: transaction.dataValues['consumerCashbackId'] == null,
      source: transaction.dataValues['source']
    };
  }

  private getIncludeForAllPaydayTransaction(): any {
    return [
      {
        attributes: [],
        model: Payout,
        required: true
      },
      {
        attributes: [],
        model: PayoutTransactionStatus,
        required: true
      },
      {
        attributes: ['currencyCode'],
        model: Currency,
        required: true
      },
      {
        attributes: [],
        model: Outlets,
        required: true
      },
      {
        attributes: [],
        model: ConsumerCashback,
        as: 'consumerCashbacks',
        required: false,
        include: [
          {
            model: Consumer,
            required: false,
            as: 'recipient'
          }
        ]
      }
    ];
  }

  private getFormattedTransactionDataV2(
    transaction: any,
    outletName: any,
    status: any,
    nextPaydayDate: Date,
    totalCashback: number,
    userBaseCurrency: Currency,
    preferredLanguage: string
  ) {
    return {
      transactionId: transaction.payoutTransactionId,
      categoryImage: transaction.dataValues['categoryLogo']
        ? transaction.dataValues['categoryLogo']
        : transaction.dataValues['groupCategoryLogo'],
      outletName: outletName,
      cashbackAmount: Number(transaction.cashbackAmount).toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }),
      currency:
        preferredLanguage === 'ar'
          ? transaction.currency.currencyCodeAr
          : transaction.currency.currencyCode,
      transactionDate: transaction.dataValues['transactionDate'],
      transactionStatus: status,
      receipt: this.receiptService.getReceiptImageUrl(transaction.receipt),
      paydayDate: nextPaydayDate,
      paydaySavingAmount: Number(totalCashback).toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }),
      paydaySavingAmountCurrency:
        preferredLanguage === 'ar'
          ? userBaseCurrency.currencyCodeAr
          : userBaseCurrency.currencyCode,
      isAppealed: transaction.isAppealed,
      cardScheme: transaction.cardScheme,
      settlementStatus:
        transaction.dataValues['groupTransactionStatusId'] === 1 ? this.settlementStatusText : null,
      isSchemeTransaction: transaction.dataValues['consumerCashbackId'] == null,
      source: transaction.source
    };
  }

  private async getConsumerHomeCurrency(userId: string) {
    return await this.subscriptionServiceProxy.getSubscriptionDateByConsumerId(userId);
  }

  private async getNextPaydayTotal(userId: any) {
    const sumResult = await this.payoutTransaction.findOne({
      attributes: [[Sequelize.fn('SUM', Sequelize.col('cashback_amount')), 'totalCashback']],
      where: {
        consumerId: userId,
        [Op.or]: [{ isRewardCredited: false }, { isRewardCredited: null }],
        payoutTransactionStatusId: PayoutTransactionStatusEnum.AddedToPayday,
        isProcessed: true
      }
    });
    return sumResult;
  }

  private async getNextPaydayTotalExcludingFailedOnUserBaseCurrency(
    userId: any,
    userBaseCurrencyId: string
  ) {
    const nextPaydaySavings = await this.payoutTransaction.findAll({
      attributes: [
        'currencyId',
        [Sequelize.fn('SUM', Sequelize.col('cashback_amount')), 'totalCashback']
      ],
      include: {
        model: Payout,
        attributes: [],
        where: {
          payoutStatusId: { [Op.ne]: PayoutStatusEnum.DisbursementFailed }
        }
      },
      where: {
        consumerId: userId,
        [Op.or]: [{ isRewardCredited: false }, { isRewardCredited: null }],
        payoutTransactionStatusId: {
          [Op.or]: [PayoutTransactionStatusEnum.AddedToPayday, PayoutTransactionStatusEnum.NoSaving]
        },
        isProcessed: true
      },
      group: ['currencyId']
    });

    const sumOfUserAllBaseCurrency = nextPaydaySavings.filter(
      (p) => p.currencyId === userBaseCurrencyId
    );
    const sumOfAllOtherCurrencies = nextPaydaySavings.filter(
      (p) => p.currencyId != userBaseCurrencyId
    );
    return await this.getSumOfUserBaseCurrencyV2(
      sumOfAllOtherCurrencies,
      userBaseCurrencyId,
      sumOfUserAllBaseCurrency,
      ''
    );
  }

  private async getSchemeWiseNextPaydayTotalOnUserBaseCurrencyV2(
    userId: any,
    userBaseCurrencyId: string
  ) {
    const retValue: any[] = [];
    const profileId = this.mimojoProfileId;
    const savingGroupByCurrencyCard = await this.payoutTransaction.findAll({
      attributes: [
        'cardScheme',
        'currencyId',
        [Sequelize.fn('SUM', Sequelize.col('cashback_amount')), 'totalCashback']
      ],
      where: {
        consumerId: userId,
        [Op.or]: [{ isRewardCredited: false }, { isRewardCredited: null }],
        payoutTransactionStatusId: PayoutTransactionStatusEnum.AddedToPayday,
        isProcessed: true,
        profileId: profileId
      },
      group: ['cardScheme', 'currencyId']
    });

    const sumOfUserAllBaseCurrencyVisa = savingGroupByCurrencyCard.filter(
      (p) => p.currencyId === userBaseCurrencyId && p.cardScheme === 'visa'
    );
    const sumOfAllOtherCurrenciesVisa = savingGroupByCurrencyCard.filter(
      (p) => p.currencyId != userBaseCurrencyId && p.cardScheme === 'visa'
    );
    retValue.push(
      await this.getSumOfUserBaseCurrencyV2(
        sumOfAllOtherCurrenciesVisa,
        userBaseCurrencyId,
        sumOfUserAllBaseCurrencyVisa,
        'visa'
      )
    );

    const sumOfUserAllBaseCurrencyMastercard = savingGroupByCurrencyCard.filter(
      (p) => p.currencyId === userBaseCurrencyId && p.cardScheme === 'mastercard'
    );
    const sumOfAllOtherCurrenciesMastercard = savingGroupByCurrencyCard.filter(
      (p) => p.currencyId != userBaseCurrencyId && p.cardScheme === 'mastercard'
    );
    retValue.push(
      await this.getSumOfUserBaseCurrencyV2(
        sumOfAllOtherCurrenciesMastercard,
        userBaseCurrencyId,
        sumOfUserAllBaseCurrencyMastercard,
        'mastercard'
      )
    );

    return retValue;
  }

  private async getSumOfUserBaseCurrencyV2(
    sumOfAllOtherCurrencies: PayoutTransaction[],
    userBaseCurrencyId: string,
    sumOfUserAllBaseCurrency: PayoutTransaction[],
    cardScheme: string
  ) {
    let sumOfAllOtherCurrenciesToBaseCurrencyAmount = 0;
    let sumOfAllOtherCurrenciesToUserBaseCurrencyAmount = 0;
    for (const sumOfForeignCurrency of sumOfAllOtherCurrencies) {
      const exchangeRate = await this.paydaySavingService.getExchangeRateToBaseCurrency(
        sumOfForeignCurrency.currencyId
      );
      sumOfAllOtherCurrenciesToBaseCurrencyAmount +=
        sumOfForeignCurrency?.dataValues['totalCashback'] *
        exchangeRate?.baseCurrencyEquivalentAmount;
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
        sumOfUserBaseCurrency?.dataValues['totalCashback']
      );
    }

    return {
      cardScheme: cardScheme,
      totalCashback: sumOfAllOtherCurrenciesToUserBaseCurrencyAmount,
      currencyId: userBaseCurrencyId
    };
  }

  private async getConditionalNextPaydayDateV2(totalCashback: number) {
    let nextPaydayResponse = null;
    if (totalCashback == 0)
      nextPaydayResponse = await this.payoutConfigurationService.getNextPaydayDatePlusOneDay();
    else nextPaydayResponse = await this.payoutConfigurationService.getNextPaydayDate();

    const nextPaydayDate = new Date(nextPaydayResponse.data);
    return nextPaydayDate;
  }

  private async getPayoutTransactionWithPaging(
    result: any,
    pageIndex: number,
    pageSize: number,
    userId: any,
    nextPaydayDate: Date
  ) {
    result = await this.payoutTransaction.findAndCountAll({
      offset: pageIndex * pageSize,
      limit: pageSize,
      attributes: this.getSelectAttribute(),
      where: {
        consumerId: userId,
        [Op.or]: [
          { '$payout.payday_date$': { [Op.gte]: nextPaydayDate } },
          { '$payout.payday_date$': null }
        ],
        isRewardCredited: { [Op.or]: [false, null] }
      },
      include: [
        { model: PayoutTransactionStatus, as: 'payoutTransactionStatus' },
        { model: Currency, as: 'currency' },
        { model: Outlets, as: 'outlets' },
        { model: Group, as: 'groups', required: false },
        { model: GroupTransaction, as: 'groupTransactions', required: false },
        {
          model: ConsumerCashback,
          as: 'consumerCashbacks',
          required: false,
          include: [{ model: Consumer, as: 'recipient', required: false }]
        },
        { model: Payout, required: false }
      ],
      order: [['transaction_timestamp', 'DESC']]
    });
    return result;
  }

  private async getPayoutTransactionWithoutPaging(result: any, userId: any, nextPaydayDate: Date) {
    result = await this.payoutTransaction.findAndCountAll({
      attributes: this.getSelectAttribute(),
      where: {
        consumerId: userId,
        [Op.or]: [
          { '$payout.payday_date$': { [Op.gte]: nextPaydayDate } },
          { '$payout.payday_date$': null }
        ],
        isRewardCredited: { [Op.or]: [false, null] }
      },
      include: [
        { model: PayoutTransactionStatus, as: 'payoutTransactionStatus' },
        { model: Currency, as: 'currency' },
        { model: Outlets, as: 'outlets' },
        { model: Group, as: 'groups', required: false },
        { model: GroupTransaction, as: 'groupTransactions', required: false },
        {
          model: ConsumerCashback,
          as: 'consumerCashbacks',
          required: false,
          include: [{ model: Consumer, as: 'recipient', required: false }]
        },
        { model: Payout, required: false }
      ],
      order: [['transaction_timestamp', 'DESC']]
    });
    return result;
  }

  private async getPayoutProcessedTransactionWithPaging(
    pageIndex: number,
    pageSize: number,
    userId: any,
    nextPaydayDate: Date,
    include: any,
    order: any
  ) {
    const result = await this.payoutTransaction.findAndCountAll({
      offset: pageIndex * pageSize,
      limit: pageSize,
      attributes: this.getSelectAttributeForProcessedTransaction(),
      where: {
        consumerId: userId,
        '$payout.payday_date$': { [Op.lt]: nextPaydayDate }
      },
      include: include,
      order: order
    });
    return result;
  }

  private async getPayoutProcessedTransactionWithoutPaging(
    userId: any,
    nextPaydayDate: Date,
    include: any,
    order: any
  ) {
    const result = await this.payoutTransaction.findAndCountAll({
      attributes: this.getSelectAttributeForProcessedTransaction(),
      where: {
        consumerId: userId,
        '$payout.payday_date$': { [Op.lt]: nextPaydayDate }
      },
      include: include,
      order: order
    });
    return result;
  }

  private async isImageFile(image: Express.Multer.File): Promise<boolean> {
    const imageMagicNumbers = {
      jpeg: [0xff, 0xd8, 0xff],
      png: [0x89, 0x50, 0x4e, 0x47],
      gif: [0x47, 0x49, 0x46, 0x38],
      bmp: [0x42, 0x4d]
    };

    return ['jpeg', 'png', 'gif', 'bmp'].some((format) =>
      imageMagicNumbers[format].every((byte, index) => byte === image.buffer[index])
    );
  }

  async getTransactionDetailsForDashboard(): Promise<
    BaseResponse<{ count: number; last24HoursCount: number; totalPayoutsDone: number } | {}>
  > {
    this.logger.info('PayoutTransactionService - getTransactionDetailsForDashboard called');
    try {
      const whereOptions: Object = { isProcessed: true };
      const count = await this.payoutTransaction.count({
        where: { ...whereOptions }
      });

      const last24HoursCount = await this.payoutTransaction.count({
        where: {
          createdOn: {
            [Op.gte]: new Date(Date.now() - 24 * 60 * 60 * 1000)
          }
        }
      });

      const totalPayoutsDone = await this.payoutTransaction.count({
        where: {
          ...whereOptions,
          isRewardCredited: true
        }
      });

      this.logger.info('PayoutTransactionService - getTransactionDetailsForDashboard completed', {
        count,
        last24HoursCount,
        totalPayoutsDone
      });
      return baseResponseHelper({ count, last24HoursCount, totalPayoutsDone });
    } catch (error) {
      this.logger.error('PayoutTransactionService.getTransactionDetailsForDashboard - exception', { error });
      const errorResponse = baseResponseHelper(
        {},
        ErrorStatusCodes.dashboardError.statusCode,
        ErrorStatusCodes.dashboardError.message
      );
      return errorResponse;
    }
  }

  async getPaydayDetailsForDashboard(
    paydayDate: string,
    timezoneInfo = 'Asia/Dubai'
  ): Promise<BaseResponse<{ successCount: number; failedCount: number } | {}>> {
    this.logger.info('PayoutTransactionService - getPaydayDetailsForDashboard called');

    if (!paydayDate) {
      throw new BadRequestException('paymentDate is required');
    }

    if (!isValidDateFormat(paydayDate)) {
      throw new BadRequestException('paymentDate must be in YYYY-MM-DD format');
    }

    try {
      const whereOptions = {
        [Op.and]: [
          Sequelize.where(
            Sequelize.fn(
              'DATE',
              Sequelize.fn('timezone', timezoneInfo, Sequelize.col('payday_date'))
            ),
            paydayDate
          )
        ]
      };
      const successCount = await this.paydayReward.count({
        where: { ...whereOptions, rewardStatusId: 2 }
      });

      const failedCount = await this.paydayReward.count({
        where: { ...whereOptions, rewardStatusId: 3 }
      });

      this.logger.info('PayoutTransactionService - getPaydayDetailsForDashboard completed', {
        successCount,
        failedCount
      });
      return baseResponseHelper({ successCount, failedCount });
    } catch (error) {
      this.logger.error('PayoutTransactionService.getPaydayDetailsForDashboard - exception', { error });
      const errorResponse = baseResponseHelper(
        {},
        ErrorStatusCodes.dashboardError.statusCode,
        ErrorStatusCodes.dashboardError.message
      );
      return errorResponse;
    }
  }

  private getSelectAttribute(): any[] {
    return [
      'payoutTransactionId',
      ['transaction_timestamp', 'transactionDate'],
      'transactionAmount',
      'cashbackAmount',
      [Sequelize.col('payoutTransactionStatus.display_name'), 'status'],
      [Sequelize.col('payoutTransactionStatus.display_name_ar'), 'statusAr'],
      [Sequelize.col('currency.currency_code'), 'currencyName'],
      [Sequelize.col('currency.currency_code_ar'), 'currencyNameAr'],
      [Sequelize.col('outlets.merchant_logo'), 'merchantLogo'],
      [Sequelize.col('outlets.category_logo'), 'categoryLogo'],
      [Sequelize.col('outlets.outlet_name'), 'outletName'],
      [Sequelize.col('outlets.outlet_name_ar'), 'outletNameAr'],
      [Sequelize.col('groups.category_logo'), 'groupCategoryLogo'],
      [Sequelize.col('groups.group_logo'), 'groupLogo'],
      [Sequelize.col('groups.group_name'), 'groupName'],
      [Sequelize.col('groupTransactions.group_transaction_status_id'), 'groupTransactionStatusId'],
      [Sequelize.col('consumerCashbacks->recipient.nick_name'), 'recipientNickName'],
      [Sequelize.col('consumerCashbacks->recipient.consumer_id'), 'recipientConsumerId'],
      ['consumer_id', 'donorConsumerId'],
      'receipt',
      'payoutTransactionStatusId',
      'isAppealed',
      'cardScheme',
      'consumerCashbackId',
      'source'
    ];
  }

  private getOutletName(transaction: any, preferredLanguage: string) {
    const recipientName =
      transaction.dataValues['recipientNickName'] === null
        ? null
        : '(' + transaction.dataValues['recipientNickName'] + ')';
    let outletName = null;
    if (preferredLanguage === 'ar') {
      if (transaction.dataValues['outletName'])
        outletName = transaction.dataValues['outletNameAr'] ?? transaction.dataValues['outletName'];
      else
        outletName = transaction.dataValues['groupNameAr'] ?? transaction.dataValues['groupName'];
    } else {
      outletName = transaction.dataValues['outletName'] ?? transaction.dataValues['groupName'];
    }
    if (recipientName != null) outletName += ' ' + recipientName;
    return { outletName, recipientName };
  }

  private getFomattedTransactionById(
    transaction: PayoutTransaction,
    status: any,
    response: any,
    preferredLanguage: string
  ) {
    const { outletName, recipientName } = this.getOutletName(transaction, preferredLanguage);
    return {
      transactionId: transaction?.payoutTransactionId,
      categoryImage: transaction.dataValues['categoryLogo']
        ? transaction.dataValues['categoryLogo']
        : transaction.dataValues['groupCategoryLogo'],
      outletName: outletName,
      cashbackAmount: Number(transaction.cashbackAmount).toFixed(2),
      transactionDate: transaction.dataValues['transactionDate'],
      transactionStatus: status,
      receipt: this.receiptService.getReceiptImageUrl(transaction.receipt),
      paydayDate: new Date(response.data),
      paydaySavingAmount: Number(transaction.cashbackAmount).toFixed(2),
      currency:
        preferredLanguage === 'ar'
          ? transaction.currency.currencyCodeAr
          : transaction.currency.currencyCode,
      isAppealed: transaction.isAppealed,
      cardScheme: transaction.cardScheme,
      settlementStatus:
        transaction.dataValues['groupTransactionStatusId'] === 1 ? this.settlementStatusText : null,
      isSchemeTransaction: transaction.dataValues['consumerCashbackId'] == null,
      source: transaction?.source
    };
  }
}
