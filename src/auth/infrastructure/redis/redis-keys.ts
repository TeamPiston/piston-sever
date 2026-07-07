export function verificationCodeKey(email: string): string {
  return `email-verification:${email}`;
}

export function refreshTokenKey(userId: string, sessionId: string): string {
  return `refresh-token:${userId}:${sessionId}`;
}
