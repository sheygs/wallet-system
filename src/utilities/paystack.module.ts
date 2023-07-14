import { Module } from '@nestjs/common';
import { PaystackService } from './paystack';

@Module({
  providers: [PaystackService],
  exports: [PaystackService],
})
export class PaystackModule {}
