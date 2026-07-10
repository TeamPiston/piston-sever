import { IsString } from 'class-validator';

/**
 * 로그인 요청 시 전달되는 자격 증명 DTO.
 */
export class LoginDto {
  /**
   * 로그인에 사용하는 사용자 아이디.
   */
  @IsString()
  id: string;

  /**
   * 로그인에 사용하는 비밀번호.
   */
  @IsString()
  password: string;
}
