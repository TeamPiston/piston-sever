import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

/**
 * 비밀번호 재설정 요청 DTO. 비밀번호 규칙은 회원가입과 동일하다.
 */
export class ResetPasswordDto {
  /** 메일로 받은 재설정 코드. */
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  token: string;

  /** 새 비밀번호 (8자 이상). */
  @IsString()
  @MinLength(8)
  newPassword: string;
}
