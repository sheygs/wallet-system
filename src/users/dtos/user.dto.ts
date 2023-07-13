import {
  IsEmail,
  IsString,
  IsPhoneNumber,
  Length,
  IsOptional,
} from 'class-validator';
import { PartialType } from '@nestjs/mapped-types';

export class CreateUserDTO {
  @IsString()
  first_name: string;

  @IsString()
  last_name: string;

  @IsEmail()
  email: string;

  @IsString()
  @Length(3, 20)
  password: string;

  @IsPhoneNumber()
  phone_number: string;
}

export class LoginUserDTO extends PartialType(CreateUserDTO) {
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
