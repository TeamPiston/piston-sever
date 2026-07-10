/**
 * 이메일 인증코드를 저장할 Redis 키를 생성한다.
 */
export function verificationCodeKey(email: string): string {
  return `email-verification:${email}`;
}

/**
 * 사용자별 세션의 리프레시 토큰을 저장할 Redis 키를 생성한다.
 */
export function refreshTokenKey(userId: string, sessionId: string): string {
  return `refresh-token:${userId}:${sessionId}`;
}
