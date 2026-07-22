import { InferAttributes } from 'sequelize';
import {
  Table,
  Column,
  DataType,
  Model,
  ForeignKey,
  BelongsTo
} from 'sequelize-typescript';
import { PayoutTransaction } from 'src/transaction/entities/payout-transaction.model';

@Table({
  timestamps: false,
  tableName: 'payouts'
})
export class Payout extends Model<InferAttributes<Payout>> {
  @Column({
    type: DataType.UUID,
    primaryKey: true
  })
  declare payoutId: string;

  @ForeignKey(() => PayoutTransaction)
  @Column({
    type: DataType.UUID,
    allowNull: true
  })
  declare payoutTransactionId: string; // Changed to string (UUID) from number to align with PayoutTransaction primary key type
  @BelongsTo(() => PayoutTransaction, 'payoutTransactionId')
  declare payoutTransaction: PayoutTransaction;

  @Column({
    type: DataType.INTEGER
  })
  declare payoutStatusId: number;

  @Column({
    type: DataType.UUID
  })
  declare userId: string;

  @Column({
    type: DataType.DATE,
    allowNull: true
  })
  declare paydayDate: Date;
}
