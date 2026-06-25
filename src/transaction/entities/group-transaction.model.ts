import { Table, Column, Model, DataType, ForeignKey, HasOne, BelongsTo } from 'sequelize-typescript';
import { InferAttributes } from 'sequelize';
import { PayoutTransaction } from './payout-transaction.model';
import { Group } from './payout-group.model';

@Table({
  timestamps: false,
  tableName: "group_transactions"
})
export class GroupTransaction extends Model<InferAttributes<GroupTransaction>> {

  @Column({
    type: DataType.UUID,
    primaryKey: true
  })
  declare groupTransactionId: string;
 
  @Column({
    type: DataType.STRING(50)
  })
  declare transactionNo: string;

  @Column({
    type: DataType.STRING(500)
  })
  declare receipt: string;

  @ForeignKey(() => Group)
  @Column({
    type: DataType.UUID,
    allowNull: true,
  })
  declare groupId: string;
  @BelongsTo(() => Group, 'groupId')
  declare groups: Group;
 
  @Column({
    type: DataType.DATE,
    allowNull: true
  })
  declare postingTimestamp: Date;
  
  @Column({
    type: DataType.DECIMAL,
    allowNull: true
  })
  declare transactionAmount: number;

  @Column({
    type: DataType.UUID,
    allowNull: true
  })
  declare notificationId: string;

  @Column({
    type: DataType.INTEGER,
    allowNull: true
  })
  declare groupTransactionStatusId: number;

  @HasOne(() => PayoutTransaction)
  declare payoutTransaction: PayoutTransaction; 
}