import { Table, Column, Model, DataType, HasMany, HasOne } from 'sequelize-typescript';
import { InferAttributes } from 'sequelize';
import { PayoutTransaction } from './payout-transaction.model';

@Table({
  timestamps: false,
  tableName: "groups"
})
export class Group extends Model<InferAttributes<Group>> {

  @Column({
    type: DataType.UUID,
    primaryKey: true
  })
  declare groupId: string;
 
  @Column({
    type: DataType.STRING(150)
  })
  declare groupName: string;

  @Column({
    type: DataType.STRING(500)
  })
  declare groupLogo: string;
 
  @Column({
    type: DataType.UUID
  })
  declare categoryId: string;
   
  @Column({
    type: DataType.STRING(255)
  })
  declare categoryName: string;

  @Column({
    type: DataType.STRING(500)
  })
  declare categoryLogo: string;

  @HasOne(() => PayoutTransaction)
  declare payoutTransaction: PayoutTransaction; 
}