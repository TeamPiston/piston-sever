import { IsEmail } from 'class-validator';

/**
 * 비밀번호 찾기 요청 시 전달되는 데이터.
 */
export class FindPasswordDto {
  /** 비밀번호를 조회할 계정의 이메일 주소. */
  @IsEmail()
  email: string;
}
