/**
 * 이메일 인증코드를 저장할 Redis 키를 생성한다.
 */
export function verificationCodeKey(email: string): string {
  return `email-verification:${email}`;
}

/**
 * 비밀번호 재설정 토큰(해시) → 사용자 ID를 저장할 Redis 키를 생성한다.
 */
export function passwordResetKey(tokenHash: string): string {
  return `password-reset:${tokenHash}`;
}

/**
 * 사용자별 현재 유효한 비밀번호 재설정 토큰 해시를 저장할 Redis 키를 생성한다.
 */
export function passwordResetUserKey(userId: string): string {
  return `password-reset-user:${userId}`;
}

/**
 * 사용자별 세션의 리프레시 토큰을 저장할 Redis 키를 생성한다.
 */
export function refreshTokenKey(userId: string, sessionId: string): string {
  return `refresh-token:${userId}:${sessionId}`;
}
