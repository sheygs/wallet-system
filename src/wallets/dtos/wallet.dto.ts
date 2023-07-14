import {
  IsString,
  IsOptional,
  IsUUID,
  IsNotEmpty,
  IsEnum,
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
