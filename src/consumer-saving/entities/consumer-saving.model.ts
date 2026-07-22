import { Table, Column, Model, DataType, ForeignKey, BelongsTo } from 'sequelize-typescript';
import { InferAttributes } from 'sequelize';
import { Currency } from 'src/transaction/entities/currency.model';

@Table({
  timestamps: false,
  tableName: 'consumer_saving'
})
export class ConsumerSaving extends Model<InferAttributes<ConsumerSaving>> {
  @Column({
    type: DataType.INTEGER,
    primaryKey: true
  })
  declare consumerSavingId: number;

  @Column({
    type: DataType.UUID
  })
  declare consumerId: string;

  @Column({
    type: DataType.DECIMAL
  })
  declare totalSaving: number;

  @ForeignKey(() => Currency)
  @Column({
    type: DataType.UUID, // Changed from INTEGER to UUID to align with Currency model ID type
    allowNull: false
  })
  declare currencyId: string;
  @BelongsTo(() => Currency, 'currencyId')
  declare currency: Currency;
}
