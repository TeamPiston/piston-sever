import { IsEmail, IsString, Matches, MinLength } from 'class-validator';

export class RegisterDto {
  @IsEmail()
  email: string;

  @Matches(/^[a-zA-Z0-9]{4,20}$/)
  id: string;

  @IsString()
  @MinLength(8)
  password: string;

  @IsString()
  code: string;
}
