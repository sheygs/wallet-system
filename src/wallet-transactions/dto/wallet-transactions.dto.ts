import {
  IsString,
  IsOptional,
  IsUUID,
  IsNotEmpty,
  IsEnum,
} from 'class-validator';

import {
  TransactionType,
  TransactionStatus,
} from '../wallet-transaction.entity';

export class CreateTransactionDTO {
  @IsString()
  @IsOptional()
  user_id?: string;

  @IsString()
  @IsUUID()
  @IsNotEmpty()
  source_wallet_id: string;

  @IsString()
  @IsNotEmpty()
  amount: number;

  @IsString()
  @IsNotEmpty()
  @IsEnum(TransactionType)
  transaction_type: TransactionType;

  @IsString()
  @IsNotEmpty()
  @IsEnum(TransactionStatus)
  transaction_status: TransactionStatus;
}
