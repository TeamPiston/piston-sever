import { resolveCorsOrigin } from './cors-origin';

describe('resolveCorsOrigin', () => {
  it('미설정이거나 비어 있으면 전체 허용', () => {
    expect(resolveCorsOrigin(undefined)).toBe('*');
    expect(resolveCorsOrigin('')).toBe('*');
    expect(resolveCorsOrigin(' , ')).toBe('*');
  });

  it("'*'가 포함되면 배열이 아니라 문자열 '*'를 반환한다", () => {
    expect(resolveCorsOrigin('*')).toBe('*');
    expect(resolveCorsOrigin('https://a.com,*')).toBe('*');
  });

  it('쉼표로 구분된 Origin 목록을 공백 제거 후 반환한다', () => {
    expect(resolveCorsOrigin('https://a.com, https://b.com ')).toEqual([
      'https://a.com',
      'https://b.com',
    ]);
  });
});
