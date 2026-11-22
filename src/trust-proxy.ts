/**
 * TRUST_PROXY 환경변수를 Express `trust proxy` 설정값으로 변환한다.
 * 미설정이면 프록시를 신뢰하지 않고(false), 숫자는 홉 수, 그 외는 쉼표로 구분된
 * 신뢰할 프록시 IP/서브넷 목록으로 해석한다. `true`처럼 전부 신뢰하는 값은 받지 않는다
 * (목록으로 넘어가 Express가 부팅 시 잘못된 IP로 거부한다).
 */
export function resolveTrustProxy(
  raw: string | undefined,
): false | number | string[] {
  const value = raw?.trim();
  if (!value) return false;
  if (/^\d+$/.test(value)) return Number(value);
  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}
