import { Table, Column, Model, DataType, ForeignKey, BelongsTo } from 'sequelize-typescript';
import { InferAttributes } from 'sequelize';
import { Currency } from './currency.model';

@Table({
  timestamps: false,
  tableName: 'payday_rewards'
})
export class PaydayReward extends Model<InferAttributes<PaydayReward>> {
  @Column({
    type: DataType.INTEGER,
    primaryKey: true,
    autoIncrement: true
  })
  declare paydayRewardId: number;

  @Column({
    type: DataType.UUID, // Changed from INTEGER to UUID to match Consumer model and userId
    allowNull: true
  })
  declare consumerId: string; // Changed from number to string to match Consumer model and userId

  @Column({
    type: DataType.DECIMAL,
    allowNull: true
  })
  declare rewardAmount: number;

  @Column({
    type: DataType.DECIMAL,
    allowNull: true
  })
  declare rewardPaidAmount: number;

  @Column({
    type: DataType.UUID,
    allowNull: true
  })
  declare rewardPaidCurrencyId: string;

  @Column({
    type: DataType.DATE,
    allowNull: true
  })
  declare paydayDate: Date;

  @Column({
    type: DataType.INTEGER,
    allowNull: true
  })
  declare rewardStatusId: number;

  @Column({
    type: DataType.DATE,
    allowNull: true
  })
  declare responseTimestamp: Date;

  @ForeignKey(() => Currency)
  @Column({
    type: DataType.UUID,
    allowNull: true
  })
  declare currencyId: string;
  @BelongsTo(() => Currency, 'currencyId')
  declare currency: Currency;
}
