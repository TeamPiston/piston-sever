import { IsEmail } from 'class-validator';

/**
 * 아이디 찾기 요청 시 전달되는 데이터.
 */
export class FindIdDto {
  /** 아이디를 조회할 계정의 이메일 주소. */
  @IsEmail()
  email: string;
}
