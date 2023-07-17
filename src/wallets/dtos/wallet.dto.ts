import { PartialType } from '@nestjs/mapped-types';
import {
  IsString,
  IsOptional,
  IsUUID,
  IsNotEmpty,
  IsEnum,
  Min,
  IsNumber,
} from 'class-validator';

import { Currency } from '../wallet.entity';

export class CreateWalletDTO {
  @IsUUID()
  @IsNotEmpty()
  user_id: string;

  @IsString()
  @IsOptional()
  @IsEnum(Currency)
  currency: Currency;
}

export class SearchWalletDTO extends CreateWalletDTO {}

export class GetWalletDTO {
  @IsString()
  @IsNotEmpty()
  @IsUUID()
  wallet_id: string;
}

export class InitializePaymentDTO extends GetWalletDTO {
  @IsNumber()
  @IsNotEmpty()
  @Min(1000)
  amount: number;
}

export class FundWalletDTO extends PartialType(InitializePaymentDTO) {
  @IsString()
  @IsNotEmpty()
  reference: string;
}
