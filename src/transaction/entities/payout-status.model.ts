import { Table, Column, Model, DataType, HasOne } from 'sequelize-typescript';
import { CreationOptional, InferAttributes, InferCreationAttributes } from 'sequelize';
import { PayoutTransaction } from './payout-transaction.model';

@Table({
  timestamps: false,
  tableName: "payout_transaction_status"
})
export class PayoutTransactionStatus extends Model<InferAttributes<PayoutTransactionStatus>> {

  @Column({
    type: DataType.INTEGER,
    primaryKey: true
  })
  declare payoutTransactionStatusId: number;

  @Column({
    type: DataType.STRING,
    allowNull: true
  })
  declare status: string;

  @Column({
    type: DataType.STRING,
    allowNull: true
  })
  declare displayName: string;

  @Column({
    type: DataType.STRING,
    allowNull: true
  })
  declare displayNameAr: string;

  @HasOne(() => PayoutTransaction)
  declare payoutTransaction: PayoutTransaction;

}
