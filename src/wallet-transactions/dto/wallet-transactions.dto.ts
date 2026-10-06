import {
  IsString,
  IsOptional,
  IsUUID,
  IsNotEmpty,
  IsEnum,
  Matches,
  Length,
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
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  from_date?: string;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  to_date?: string;

  @IsOptional()
  @Matches(/^(?:[1-9]|1[0-2])$/)
  target_month?: string;

  @IsOptional()
  @Matches(/^[1-9]\d{3}$/)
  target_year?: string;

  @IsOptional()
  @Matches(/^(?:[1-9]|[1-9]\d|100)$/)
  limit?: string;

  @IsOptional()
  @IsString()
  @Length(1, 512)
  cursor?: string;
}
