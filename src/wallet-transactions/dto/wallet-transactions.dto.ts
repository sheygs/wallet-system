import {
  IsString,
  IsOptional,
  IsUUID,
  IsNotEmpty,
  IsEnum,
  IsDateString,
  IsInt,
  Min,
  Max,
} from 'class-validator';

import {
  TransactionType,
  TransactionStatus,
} from '../wallet-transaction.entity';

export class CreateTransactionDTO {
  @IsUUID()
  @IsOptional()
  user_id?: string;

  @IsString()
  @IsUUID()
  @IsNotEmpty()
  source_wallet_id: string;

  @IsInt()
  @Min(1)
  @Max(Number.MAX_SAFE_INTEGER)
  amount: number;

  @IsString()
  @IsNotEmpty()
  @IsOptional()
  reference: string;

  @IsString()
  @IsNotEmpty()
  @IsEnum(TransactionType)
  transaction_type: TransactionType;

  @IsString()
  @IsNotEmpty()
  @IsEnum(TransactionStatus)
  transaction_status: TransactionStatus;
}

export class TransactionHistoryDTO {
  @IsString()
  @IsDateString()
  @IsOptional()
  from_date: Date;

  @IsString()
  @IsDateString()
  @IsOptional()
  to_date: Date;

  @IsString()
  @IsOptional()
  target_month: string;

  @IsString()
  @IsOptional()
  target_year: string;
}
