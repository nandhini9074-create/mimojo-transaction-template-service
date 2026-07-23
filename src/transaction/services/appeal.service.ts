import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Appeal } from '../entities/appeal.model';

@Injectable()
export class AppealService {
  constructor(
    @InjectModel(Appeal)
    private readonly appeal: typeof Appeal
  ) {}

  async upsertAppealTransaction(transactionId: string, note: string) {
    let appeal = await this.appeal.findOne({ where: { payoutTransactionId: transactionId } });
    if (appeal) {
      appeal.note = note;
      appeal.modified_on = new Date();
      this.appeal.update(appeal, { where: { payoutTransactionId: transactionId } });
    } else {
      appeal = {
        payoutTransactionId: transactionId,
        note: note,
        created_on: new Date(),
        modified_on: new Date(),
      } as Appeal;
      this.appeal.create(appeal);
    }
  }
}
