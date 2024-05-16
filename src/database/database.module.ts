import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { dataSource } from '../ormconfig';

@Module({
  imports: [TypeOrmModule.forRoot(dataSource)],
})
export class DatabaseModule {}
