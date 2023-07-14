import { Module } from '@nestjs/common';
import { Helpers } from './helpers';

@Module({
  providers: [Helpers],
  exports: [Helpers],
})
export class HelpersModule {}
