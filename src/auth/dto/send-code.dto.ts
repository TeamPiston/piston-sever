import { IsEmail } from 'class-validator';

/**
 * 이메일 인증코드 발송 요청 DTO.
 */
export class SendCodeDto {
  /**
   * 인증코드를 받을 이메일 주소.
   */
  @IsEmail()
  email: string;
}
