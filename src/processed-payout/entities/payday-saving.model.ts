import { InferAttributes } from 'sequelize';
import { Column, DataType, Table, Model } from 'sequelize-typescript';

@Table({
  timestamps: false,
  tableName: 'payday_saving'
})
export class PaydaySaving extends Model<InferAttributes<PaydaySaving>> {
  @Column({
    type: DataType.INTEGER,
    primaryKey: true,
    autoIncrement: true
  })
  declare paydaySavingId: number;

  @Column({
    type: DataType.UUID
  })
  declare consumerId: string;

  @Column({
    type: DataType.UUID
  })
  declare cardId: string;

  @Column({
    type: DataType.DECIMAL
  })
  declare paydaySavingAmount: number;

  @Column({
    type: DataType.UUID
  })
  declare currencyId: string;

  @Column({
    type: DataType.DATEONLY
  })
  declare paydayDate: Date;

  @Column({
    type: DataType.UUID,
    allowNull: true
  })
  declare profileId: string;
}
