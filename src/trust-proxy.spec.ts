import { resolveTrustProxy } from './trust-proxy';

describe('resolveTrustProxy', () => {
  it('미설정이거나 비어 있으면 프록시를 신뢰하지 않는다', () => {
    expect(resolveTrustProxy(undefined)).toBe(false);
    expect(resolveTrustProxy('  ')).toBe(false);
  });

  it('숫자는 홉 수로 해석한다', () => {
    expect(resolveTrustProxy('1')).toBe(1);
  });

  it('그 외는 쉼표로 구분된 프록시 주소 목록으로 해석한다', () => {
    expect(resolveTrustProxy('10.0.0.117, loopback')).toEqual([
      '10.0.0.117',
      'loopback',
    ]);
  });
});
