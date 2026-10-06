import { PartialType } from '@nestjs/mapped-types';
import {
  IsString,
  IsOptional,
  IsUUID,
  IsNotEmpty,
  IsEnum,
  Min,
  IsInt,
  Max,
} from 'class-validator';

import { Currency } from '../wallet.entity';

export class CreateWalletDTO {
  @IsUUID()
  @IsNotEmpty()
  user_id: string;

  @IsString()
  @IsOptional()
  @IsEnum(Currency)
  currency?: Currency;
}

export class SearchWalletDTO extends CreateWalletDTO {}

export class GetWalletDTO {
  @IsString()
  @IsNotEmpty()
  @IsUUID()
  wallet_id: string;
}

export class InitializePaymentDTO extends GetWalletDTO {
  @IsInt()
  @Max(Number.MAX_SAFE_INTEGER)
  @IsNotEmpty()
  @Min(1000)
  amount: number;
}

export class FundWalletDTO extends PartialType(InitializePaymentDTO) {
  @IsString()
  @IsNotEmpty()
  reference: string;
}
