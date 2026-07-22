import {
  Table,
  Column,
  Model,
  DataType,
  ForeignKey,
  BelongsTo
} from 'sequelize-typescript';
import { InferAttributes } from 'sequelize';
import { Currency } from 'src/transaction/entities/currency.model';

@Table({
  timestamps: false,
  tableName: 'currency_exchange_rate'
})
export class CurrencyExchangeRate extends Model<InferAttributes<CurrencyExchangeRate>> {
  @ForeignKey(() => Currency)
  @Column({
    type: DataType.UUID,
    allowNull: false,
    primaryKey: true
  })
  declare foreignCurrencyId: string;
  @BelongsTo(() => Currency, 'foreignCurrencyId')
  declare foreignCurrency: Currency;

  @Column({
    type: DataType.DECIMAL,
    allowNull: false
  })
  declare foreignCurrencyAmount: number;

  @ForeignKey(() => Currency)
  @Column({
    type: DataType.UUID,
    allowNull: false,
    primaryKey: true
  })
  declare baseCurrencyId: string;
  @BelongsTo(() => Currency, 'baseCurrencyId')
  declare baseCurrency: Currency;

  @Column({
    type: DataType.DECIMAL,
    allowNull: false
  })
  declare baseCurrencyEquivalentAmount: number;

  @Column({
    type: DataType.DATE,
    allowNull: true
  })
  declare exchangeDate: Date;
}
