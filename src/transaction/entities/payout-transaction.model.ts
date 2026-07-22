import { Table, Column, Model, DataType, ForeignKey, BelongsTo, HasOne } from 'sequelize-typescript';
import { InferAttributes } from 'sequelize';
import { Currency } from './currency.model';
import { PayoutTransactionStatus } from './payout-status.model';
import { Payout } from 'src/processed-payout/entities/payout.model';
import { Appeal } from './appeal.model';
import { Outlets } from './payout-merchant-outlet.model';
import { Group } from './payout-group.model';
import { GroupTransaction } from './group-transaction.model';
import { ConsumerCashback } from './consumer-cashback.model';

@Table({
  timestamps: false,
  tableName: 'payout_transactions'
})
export class PayoutTransaction extends Model<InferAttributes<PayoutTransaction>> {
  @Column({
    type: DataType.UUID,
    primaryKey: true
  })
  declare payoutTransactionId: string;

  @Column({
    type: DataType.UUID,
    allowNull: true
  })
  declare transactionId: string;

  @Column({
    type: DataType.STRING,
    allowNull: true,
  })
  declare receipt: string;

  @ForeignKey(() => Outlets)
  @Column({
    type: DataType.UUID,
    allowNull: true
  })
  declare outletId: string;
  @BelongsTo(() => Outlets, 'outletId')
  declare outlets: Outlets;

  @Column({
    type: DataType.UUID,
    allowNull: true
  })
  declare consumerId: string;


  @Column({
    type: DataType.DECIMAL,
    allowNull: true
  })
  declare cashbackAmount: number;

  @Column({
    type: DataType.DECIMAL,
    allowNull: true
  })
  declare transactionAmount: number;

  @Column({
    type: DataType.DATE,
    allowNull: true
  })
  declare transactionTimestamp: Date;

  @Column({
    type: DataType.BOOLEAN,
    allowNull: true
  })
  declare isProcessed: boolean;

  @Column({
    type: DataType.BOOLEAN,
    allowNull: true
  })
  declare isAppealed: boolean;

  @Column({
    type: DataType.BOOLEAN,
    allowNull: true
  })
  declare isRewardCredited: boolean;

  @ForeignKey(() => PayoutTransactionStatus)
  @Column({
    type: DataType.INTEGER,
    allowNull: true,
  })
  declare payoutTransactionStatusId: number;
  @BelongsTo(() => PayoutTransactionStatus, 'payoutTransactionStatusId')
  declare payoutTransactionStatus: PayoutTransactionStatus;

  @ForeignKey(() => Currency)
  @Column({
    type: DataType.UUID,
    allowNull: true,
  })
  declare currencyId: string;
  @BelongsTo(() => Currency, 'currencyId')
  declare currency: Currency;

  @Column({
    type: DataType.STRING,
    allowNull: true,
  })
  declare cardScheme: string;

  @Column({
    type: DataType.STRING,
    allowNull: true,
  })
  declare cardLast4Digit: string;

  @ForeignKey(() => Group)
  @Column({
    type: DataType.UUID,
    allowNull: true
  })
  declare groupId: string;
  @BelongsTo(() => Group, 'groupId')
  declare groups: Group;

  @ForeignKey(() => GroupTransaction)
  @Column({
    type: DataType.UUID,
    allowNull: true
  })
  declare groupTransactionId: string;
  @BelongsTo(() => GroupTransaction, 'groupTransactionId')
  declare groupTransactions: GroupTransaction;

  @ForeignKey(() => ConsumerCashback)
  @Column({
    type: DataType.UUID,
    allowNull: true
  })
  declare consumerCashbackId: string;
  @BelongsTo(() => ConsumerCashback, 'consumerCashbackId')
  declare consumerCashbacks: ConsumerCashback;
  
  @Column({
    type: DataType.STRING,
    allowNull: true,
  })
  declare source: string;

  @Column({
    type: DataType.DATE,
    allowNull: false,
    defaultValue: DataType.NOW
  })
  declare createdOn: Date;

  @Column({
    type: DataType.UUID,
    allowNull: true,
  })
  declare profileId: string;

  @Column({
    type: DataType.UUID,
    allowNull: true,
  })
  declare transactionCardId: string;

  @HasOne(() => Payout)
  declare payout: Payout;

  @HasOne(() => Appeal)
  declare appeal: Appeal;  
}
