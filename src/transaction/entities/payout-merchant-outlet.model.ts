import { Table, Column, Model, DataType, HasMany, HasOne } from 'sequelize-typescript';
import { InferAttributes } from 'sequelize';
import { PayoutTransaction } from './payout-transaction.model';

@Table({
  timestamps: false,
  tableName: "outlets"
})
export class Outlets extends Model<InferAttributes<Outlets>> {

  @Column({
    type: DataType.UUID,
    primaryKey: true
  })
  declare outletId: string;
  
  @Column({
    type: DataType.UUID
  })
  declare merchantId: string;

  @Column({
    type: DataType.UUID
  })
  declare categoryId: string;
   
  @Column({
    type: DataType.STRING(150)
  })
  declare merchantName: string;

  @Column({
    type: DataType.STRING(150)
  })
  declare outletName: string;

  @Column({
    type: DataType.STRING(500)
  })
  declare merchantLogo: string;

  @Column({
    type: DataType.STRING(500)
  })
  declare categoryLogo: string;

  @Column({
    type: DataType.STRING(255)
  })
  declare categoryName: string;

  @HasOne(() => PayoutTransaction)
  declare payoutTransaction: PayoutTransaction; 
}