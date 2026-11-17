import { IsEmail, IsString, Matches, MinLength } from 'class-validator';

/**
 * 회원가입 요청 DTO.
 */
export class RegisterDto {
  /**
   * 인증코드를 전송받을 이메일 주소.
   */
  @IsEmail()
  email: string;

  /**
   * 영문/숫자 4~20자로 구성된 로그인 아이디.
   */
  @Matches(/^[a-zA-Z0-9]{4,20}$/)
  id: string;

  /**
   * 8자 이상의 비밀번호.
   */
  @IsString()
  @MinLength(8)
  password: string;

  /**
   * 이메일로 발송된 인증코드.
   */
  @IsString()
  code: string;
}
