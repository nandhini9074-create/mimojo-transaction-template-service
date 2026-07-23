import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { ConsumerSaving } from '../entities/consumer-saving.model';
import { Currency } from 'src/transaction/entities/currency.model';

@Injectable()
export class ConsumerSavingService {
  constructor(
    @InjectModel(ConsumerSaving)
    private readonly consumerSaving: typeof ConsumerSaving
  ) {}

  public async getTotalSaving(userId: string): Promise<ConsumerSaving> {
    const payoutTransaction = await this.consumerSaving.findOne({
      attributes: ['totalSaving'],
      include: [
        {
          model: Currency,
        },
      ],
      where: { consumerId: userId },
    });
    return payoutTransaction;
  }
}
