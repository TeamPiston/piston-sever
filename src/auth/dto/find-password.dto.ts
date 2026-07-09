import { IsEmail } from 'class-validator';

export class FindPasswordDto {
  @IsEmail()
  email: string;
}
