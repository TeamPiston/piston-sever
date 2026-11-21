/**
 * CORS_ORIGIN 환경변수를 `enableCors`의 origin 옵션으로 변환한다.
 * 미설정이면 전체 허용('*'), 설정되어 있으면 쉼표로 구분된 허용 목록을 반환한다.
 * ('*'를 배열에 넣으면 cors가 문자열 "*"와 그대로 비교해 모든 Origin을 거부한다.)
 */
export function resolveCorsOrigin(raw: string | undefined): string | string[] {
  const origins = (raw ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  if (origins.length === 0 || origins.includes('*')) return '*';
  return origins;
}
