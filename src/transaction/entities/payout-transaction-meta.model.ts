import { Column, DataType, Model, Table } from 'sequelize-typescript';
import { InferAttributes } from 'sequelize';

@Table({
  timestamps: false,
  tableName: 'payout_transaction_meta',
})
export class PayoutTransactionMeta extends Model<InferAttributes<PayoutTransactionMeta>> {
  @Column({
    type: DataType.UUID,
    primaryKey: true,
  })
  declare payoutTransactionMetaId: string;

  @Column({
    type: DataType.UUID,
    allowNull: false,
  })
  declare payoutTransactionId: string;

  @Column({
    type: DataType.JSONB,
    allowNull: true,
  })
  declare rewardRef: Record<string, unknown> | null;
}
