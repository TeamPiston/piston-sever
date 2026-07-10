/**
 * JWT(액세스/리프레시 토큰)에 담기는 페이로드 구조.
 */
export interface JwtPayload {
  /** 사용자 고유 식별자 (subject). */
  sub: string;
  /** 사용자 로그인 아이디. */
  loginId: string;
  /** 세션 식별자. */
  sessionId: string;
}
