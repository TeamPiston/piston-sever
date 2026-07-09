import { IsEmail } from 'class-validator';

export class FindIdDto {
  @IsEmail()
  email: string;
}
