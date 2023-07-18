import {
  IsEmail,
  IsString,
  IsPhoneNumber,
  Length,
  IsOptional,
  IsNotEmpty,
} from 'class-validator';

export class CreateUserDTO {
  @IsString()
  @IsNotEmpty()
  first_name: string;

  @IsString()
  @IsNotEmpty()
  last_name: string;

  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  @Length(3, 20)
  password: string;

  @IsPhoneNumber()
  @IsNotEmpty()
  phone_number: string;
}

export class LoginUserDTO {
  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  @Length(3, 20)
  password: string;

  @IsPhoneNumber()
  @IsOptional()
  phone_number?: string;
}
