import { Table, Column, Model, DataType, ForeignKey, BelongsTo, HasOne } from 'sequelize-typescript';
import { InferAttributes } from 'sequelize';
import { PayoutTransaction } from './payout-transaction.model';
import { Consumer } from './consumer.model';

@Table({
  timestamps: false,
  tableName: 'consumer_cashback'
})
export class ConsumerCashback extends Model<InferAttributes<ConsumerCashback>> {
  @Column({
    type: DataType.UUID,
    primaryKey: true
  })
  declare consumerCashbackId: string;
  
  @Column({
    type: DataType.UUID,
    allowNull: true
  })
  declare notificationId: string;

  @Column({
    type: DataType.UUID,
    allowNull: true
  })
  declare consumerId: string;

  @ForeignKey(() => Consumer)
  @Column({
    type: DataType.UUID,
    allowNull: true
  })
  declare recipientId: string;
  @BelongsTo(() => Consumer, 'recipientId')
  declare recipient: Consumer;

  @Column({
    type: DataType.DECIMAL,
    allowNull: true
  })
  declare cashbackAmount: number;

  @Column({
    type: DataType.DATE,
    allowNull: true
  })
  declare transactionTimestamp: Date;

  @HasOne(() => PayoutTransaction)
  declare payoutTransaction: PayoutTransaction; 
}