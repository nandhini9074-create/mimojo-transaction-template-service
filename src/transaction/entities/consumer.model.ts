import { Table, Column, Model, DataType, HasOne } from 'sequelize-typescript';
import { InferAttributes } from 'sequelize';
import { ConsumerCashback } from './consumer-cashback.model';
import { GenderEnum } from '../dtos/customer-pii-data.dto';

@Table({
  timestamps: false,
  tableName: "consumers"
})
export class Consumer extends Model<InferAttributes<Consumer>> {

  @Column({
    type: DataType.UUID,
    primaryKey: true
  })
  declare consumerId: string;

  @Column({
    type: DataType.STRING
  })
  declare nickName: string;

  @Column({
    type: DataType.STRING
  })
  declare firstName: string;

  @Column({
    type: DataType.STRING
  })
  declare lastName: string;

  @Column({
    type: DataType.BOOLEAN
  })
  declare isDeleted: boolean;

  @Column({
    type: DataType.ARRAY(DataType.UUID),
    allowNull: true
  })
  declare profileIds: string[];

  @Column({
    type: DataType.STRING
  })
  declare mobile: string;

  @Column({
    type: DataType.STRING
  })
  declare email: string;

  @Column({
    type: DataType.STRING
  })
  declare gender: GenderEnum;

  @Column({
    type: DataType.DATE,
    allowNull: true
  })
  dateOfBirth: string;

  @Column({
    type: DataType.STRING,
    allowNull: true
  })
  nationality: string;

  @HasOne(() => ConsumerCashback)
  declare consumerCashback: ConsumerCashback;
}