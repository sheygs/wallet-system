import {
  IsNumber,
  IsString,
  IsEnum,
  IsOptional,
  IsUUID,
  IsNotEmpty,
  Min,
  IsBoolean,
} from 'class-validator';
import { Currency } from '../../wallets/wallet.entity';

export class CreateTransferDTO {
  @IsString()
  @IsNotEmpty()
  @IsUUID()
  source_wallet_id: string;

  @IsString()
  @IsNotEmpty()
  @IsUUID()
  destination_wallet_id: string;

  @IsNumber()
  @IsNotEmpty()
  @Min(1000)
  amount: number;

  @IsString()
  @IsOptional()
  @IsEnum(Currency)
  currency: Currency;

  @IsString()
  @IsOptional()
  reason: string;
}

export class TransferIdDTO {
  @IsString()
  @IsNotEmpty()
  @IsUUID()
  transfer_id: string;
}

export class ApproveTransferDTO {
  @IsBoolean()
  @IsNotEmpty()
  approved: boolean;
}
