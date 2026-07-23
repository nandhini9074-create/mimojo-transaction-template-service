import { SequelizeModule } from '@nestjs/sequelize';
import { ConsumerSaving } from './entities/consumer-saving.model';
import { Module } from '@nestjs/common';

@Module({
  imports: [SequelizeModule.forFeature([ConsumerSaving])],
})
export class ConsumerSavingModule {}
