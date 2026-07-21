import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { PayoutTransaction } from '../entities/payout-transaction.model';
import { Op, Sequelize } from 'sequelize';
import { Currency } from '../entities/currency.model';
import { PayoutTransactionStatus } from '../entities/payout-status.model';
import { ErrorMessages } from 'src/common/errors/error-messages';
import { PayoutConfigurationService } from 'src/payout-configuration/services/payout-configuration.service';
import { ReceiptService } from './receipt.service';
import { Outlets } from '../entities/payout-merchant-outlet.model';
import { PayoutTransactionStatusEnum } from '../enum/payout-transaction-status.enum';
import { Payout } from 'src/processed-payout/entities/payout.model';
import { PaydaySavingService } from 'src/processed-payout/services/payday-saving.service';
import { PayoutStatusEnum } from '../enum/payout-status.enum';
import { Group } from '../entities/payout-group.model';
import { GroupTransaction } from '../entities/group-transaction.model';
import { ConsumerCashback } from '../entities/consumer-cashback.model';
import { Consumer } from '../entities/consumer.model';
import { EnvKeysEnum } from 'config/env.enum';
import * as dayjs from 'dayjs';
import * as utc from 'dayjs/plugin/utc';
import * as timezone from 'dayjs/plugin/timezone';
import { CmsServiceProxy } from '../proxies/cms-service.proxy';
import { ConsumerIdentityAdibServiceProxy } from '../proxies/consumer-identity-service.proxy';
import { v4 as uuidv4 } from 'uuid';
import { ConsumerStatus } from '../enum/consumer-status.enum';
import { baseResponseHelper } from 'src/common/helpers/base-response.helper';
import { CommonService } from 'src/common/service/common.service';
import { MerchantAdaptorServiceProxy } from '../proxies/merchant-adaptor-service.proxy';
import { TransactionQueryParams } from '../dtos/get-transaction.dto';
import { CustomerPiiDataDto } from '../dtos/customer-pii-data.dto';
import { CustomPinoLogger } from 'src/logger/custom-logger.service';

dayjs.extend(utc);
dayjs.extend(timezone);

@Injectable()
export class PayoutTransactionService {
  constructor(
    @InjectModel(PayoutTransaction)
    private readonly payoutTransaction: typeof PayoutTransaction,
    private readonly payoutConfigurationService: PayoutConfigurationService,
    private readonly receiptService: ReceiptService,
    private readonly paydaySavingService: PaydaySavingService,
    private readonly cmsProxy: CmsServiceProxy,
    private readonly consumerIdentityAdibProxy: ConsumerIdentityAdibServiceProxy,
    @InjectModel(Consumer)
    private readonly consumer: typeof Consumer,
    private readonly logger: CustomPinoLogger,
    private readonly commonService: CommonService,
    private readonly merchantAdaptorServiceProxy: MerchantAdaptorServiceProxy
  ) {}

  async getTransactionSummary(userId: string, preferredLanguage: string): Promise<any> {
    const traceId = uuidv4();
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

      const consumerSaving = await this.paydaySavingService.getConsumerLifetimeSaving(
        consumerCurrency?.currencyId,
        userCardsIds
      );

      if (consumerSaving) {
        consumerTotalSaving = consumerSaving;
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
    const traceId = uuidv4();
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
        ? transaction.dataValues.payoutTransactionStatus.dataValues.displayNameAr
        : transaction.dataValues.payoutTransactionStatus.dataValues.displayName;
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
    const traceId = uuidv4();
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
        return 'success';
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
    const traceId = uuidv4();
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
        note,
        traceId
      );
      this.logger.info('PayoutTransactionService.appeal - appeal response', { appealResponse });
      if (appealResponse?.success?.isSuccess === true) {
        return baseResponseHelper({}, HttpStatus.OK, 'Success');
      }
    } catch (error) {
      this.logger.error('PayoutTransactionService.appeal - exception;', {
        error,
        userId,
        trasactionId: id,
        traceId
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
      transactionId: transaction.dataValues.payoutTransactionId,
      merchantLogo: transaction.dataValues['merchantLogo'] ?? null,
      merchantName: merchantName,
      transactionAmount: Number(transaction.dataValues.transactionAmount).toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }),
      cashbackAmount: Number(transaction.dataValues.cashbackAmount).toLocaleString('en-US', {
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
      cardLast4Digits: transaction.dataValues.cardLast4Digit,
      transactionDate: transaction.dataValues['transactionDate'],
      paydayDate: nextPaydayDate,
      transactionStatus: status,
      receipt: this.receiptService.getReceiptImageUrl(transaction.dataValues.receipt)
    };
  }

  private async getotalExcludingFailedOnUserBaseCurrency(
    userBaseCurrencyId: string,
    userCards: string[] | null,
    fromDate: string | null,
    toDate: string | null
  ) {
    this.logger.info(
      'PayoutTransactionService.getotalExcludingFailedOnUserBaseCurrency - started',
      { userBaseCurrencyId, userCards, fromDate, toDate }
    );
    if (userCards === null || userCards.length === 0) {
        return [];
      }
    try {
      const whereClause: any = {
        payoutTransactionStatusId: {
          [Op.in]: [
            PayoutTransactionStatusEnum.HonouredByIssuer,
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
    this.logger.info(
      'PayoutTransactionService.getSchemeWiseNextPaydayTotalOnUserBaseCurrency - started',
      { userBaseCurrencyId }
    );
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
          payoutTransactionStatusId: PayoutTransactionStatusEnum.HonouredByIssuer,
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
    this.logger.info('PayoutTransactionService.getConditionalNextPaydayDate - started', {
      totalCashback
    });
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
    this.logger.info('PayoutTransactionService.getAllPayoutTransactionForUserCards - started', {
      pageIndex,
      pageSize,
      userCardIds,
      fromDate,
      toDate
    });
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
    this.logger.info('PayoutTransactionService.findConsumer - started', { consumerId });
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
      this.logger.info('PayoutTransactionService.findConsumer - completed', { response });
      return response;
    } catch (ex) {
      this.logger.error('PayoutTransactionService.findConsumer - exception;', {
        error: ex,
        consumerId
      });
      throw ex;
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
}
