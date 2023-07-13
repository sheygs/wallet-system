import { IsString, IsOptional, IsUUID } from 'class-validator';

export class CreateWalletDTO {
  @IsUUID()
  user_id: string;

  @IsString()
  @IsOptional()
  currency: string;
}
