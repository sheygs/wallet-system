import { IsEmail, IsString, IsPhoneNumber, IsOptional } from 'class-validator';

export class CreateUserDto {
  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  password: string;

  @IsPhoneNumber()
  @IsOptional()
  phone_number?: string;
}
