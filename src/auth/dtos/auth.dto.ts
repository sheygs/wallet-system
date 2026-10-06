import {
  IsEmail,
  IsString,
  IsPhoneNumber,
  Length,
  IsOptional,
  IsNotEmpty,
} from 'class-validator';

export class LoginUserDTO {
  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  @IsNotEmpty()
  @Length(3, 72)
  password: string;

  @IsPhoneNumber()
  @IsOptional()
  phone_number?: string;
}

export class RefreshTokenDTO {
  @IsString()
  @Length(43, 43)
  refresh_token: string;
}
