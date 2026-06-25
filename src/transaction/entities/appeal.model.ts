import { Table, Column, Model, DataType, ForeignKey, BelongsTo } from 'sequelize-typescript';
import { InferAttributes } from 'sequelize';
import { PayoutTransaction } from './payout-transaction.model';

@Table({
  timestamps: false,
  tableName: 'appeals'
})
export class Appeal extends Model<InferAttributes<Appeal>> {
    @Column({
        type: DataType.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    })
    declare appealId: number;

    @ForeignKey(() => PayoutTransaction)
    @Column({
        type: DataType.UUID,
        allowNull: false,
    })
    declare payoutTransactionId: string;
    @BelongsTo(() => PayoutTransaction, 'payoutTransactionId')
    declare payoutTransaction: PayoutTransaction;

    @Column({
        type: DataType.STRING(200),

        allowNull: false
    })
    declare note: string;

    @Column({
        type: DataType.DATE,

        allowNull: false
    })
    declare created_on: Date;

    @Column({
        type: DataType.DATE,

        allowNull: false
    })
    declare modified_on: Date;
}
