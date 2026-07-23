import { Table, Column, Model, DataType, HasOne, HasMany } from 'sequelize-typescript';
import { InferAttributes } from 'sequelize';
import { PayoutTransaction } from './payout-transaction.model';
import { ConsumerSaving } from 'src/consumer-saving/entities/consumer-saving.model';
import { PaydayReward } from './payday-rewards.model';

@Table({
  timestamps: false,
  tableName: "currency"
})
export class Currency extends Model<InferAttributes<Currency>> {

  @Column({
    type: DataType.STRING,
    primaryKey: true
  })
  declare currencyId: string;

  @Column({
    type: DataType.STRING,
    allowNull: true
  })
  declare currencyName: string;

  @Column({
    type: DataType.STRING,
    allowNull: true
  })
  declare country: string;

  @Column({
    type: DataType.STRING,
    allowNull: true
  })
  declare currencyCode: string;

  @Column({
    type: DataType.STRING,
    allowNull: true
  })
  declare currencyCodeAr: string;

  @HasMany(() => PayoutTransaction)
  declare payoutTransaction: PayoutTransaction;

  @HasOne(() => ConsumerSaving)
  declare consumerSaving: ConsumerSaving;

  @HasMany(() => PaydayReward)
  declare paydayReward: PaydayReward;
}

