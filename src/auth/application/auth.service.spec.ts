import { QueryFailedError } from 'typeorm';
import { isDuplicateEntryError } from './auth.service';

describe('isDuplicateEntryError', () => {
  const queryError = (code: string) =>
    new QueryFailedError(
      'INSERT ...',
      [],
      Object.assign(new Error(), { code }),
    );

  it('PostgreSQL unique 제약 위반(23505)을 중복으로 판별한다', () => {
    expect(isDuplicateEntryError(queryError('23505'))).toBe(true);
  });

  it('다른 DB 오류나 일반 오류는 중복으로 보지 않는다', () => {
    expect(isDuplicateEntryError(queryError('23503'))).toBe(false);
    expect(isDuplicateEntryError(queryError('ER_DUP_ENTRY'))).toBe(false);
    expect(isDuplicateEntryError(new Error('23505'))).toBe(false);
  });
});
