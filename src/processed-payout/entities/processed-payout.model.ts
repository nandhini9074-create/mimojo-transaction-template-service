import { InferAttributes } from 'sequelize';
import { Table, Column, DataType, HasOne, ForeignKey, BelongsTo, Model } from 'sequelize-typescript';
import { Payout } from './payout.model';
import { PaydaySaving } from './payday-saving.model';

@Table({
  timestamps: false,
  tableName: 'processed_payout',
})
export class ProcessedPayout extends Model<InferAttributes<ProcessedPayout>> {
  // @Column({
  //     type: DataType.BIGINT,
  //     primaryKey: true,
  //     autoIncrement: true
  // })
  // declare processedPayoutId: number;
  // @ForeignKey(() => PaydaySaving)
  // @Column({
  //   type: DataType.INTEGER,
  //   allowNull: false,
  // })
  // declare paydaySavingId: number;
  // @BelongsTo(() => PaydaySaving, 'paydaySavingId')
  // declare paydaySaving: PaydaySaving;
  // @ForeignKey(() => Payout)
  // @Column({
  //   type: DataType.UUID,
  //   allowNull: false,
  // })
  // declare payoutId: string;
  // @BelongsTo(() => Payout, 'payoutId')
  // declare payout: Payout;
}
