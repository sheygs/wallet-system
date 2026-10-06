import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { dataSource } from '../ormconfig';
import { RuntimeDatabasePolicy } from './runtime-policy';
import { ReconciliationService } from './reconciliation.service';

@Module({
  imports: [TypeOrmModule.forRoot(dataSource)],
  providers: [RuntimeDatabasePolicy, ReconciliationService],
})
export class DatabaseModule {}
