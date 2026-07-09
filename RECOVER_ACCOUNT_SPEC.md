# 아이디/비밀번호 찾기 구현 스펙

## 결정 사항 요약

| 항목               | 결정                                                                                   |
| ------------------ | -------------------------------------------------------------------------------------- |
| 비밀번호 저장 방식 | 평문 저장/비교 (bcrypt 해시 제거, A안)                                                 |
| 기존 테스트 데이터 | 없음 → 마이그레이션/호환 처리 불필요                                                   |
| 기능 구성          | 아이디 찾기 / 비밀번호 찾기 **분리** (엔드포인트, DTO, 메일 각각 독립)                 |
| 입력값             | 둘 다 이메일만 입력받음 (아이디+이메일 조합 인증 없음)                                 |
| 계정 없을 때 응답  | `404 NotFoundException` (계정 존재 여부 노출, 기존 `sendVerificationCode` 패턴과 일관) |
| 엔드포인트         | `POST /find-id`, `POST /find-password`                                                 |
| 결과 전달 방식     | 둘 다 이메일로 발송 (아이디도 응답에 직접 담지 않음)                                   |
| 요청 스팸 방지     | 둘 다 `@Throttle({ default: { limit: 3, ttl: 60000 } })` (`sendCode`와 동일)           |
| 응답 형식          | 둘 다 `204 No Content` (실제 정보는 이메일로만 전달)                                   |
| 컨트롤러 위치      | `AuthController` (클래스 레벨 `@Public` 상속 → 인증 불필요)                            |

---

## 영향받는 기존 코드

### `src/auth/application/auth.service.ts`

- `register()`: `bcrypt.hash(dto.password, BCRYPT_SALT_ROUNDS)` 제거, `dto.password` 그대로 저장
- `login()`: `bcrypt.compare(dto.password, user.password)` 제거, `dto.password === user.password` 직접 비교
- `BCRYPT_SALT_ROUNDS`, `bcrypt` import는 유지 (리프레시 토큰 해시에 계속 사용됨, `issueTokens()` 참고)
- 신규 메서드 `findId(rawEmail: string): Promise<void>`
  - `normalizeEmail`로 정규화 → `userService.findByEmail(email)` 조회
  - 없으면 `NotFoundException('가입된 계정이 없습니다.')`
  - `mailService.sendIdRecovery(email, user.loginId)` 호출
- 신규 메서드 `findPassword(rawEmail: string): Promise<void>`
  - 위와 동일하게 조회/검증
  - `mailService.sendPasswordRecovery(email, user.password)` 호출

### `src/user/application/user.service.ts`

- 신규 메서드 `findByEmail(email: string): Promise<User | null>` 추가 (`findByLoginId`와 동일한 패턴, 두 기능이 공유)

### `src/auth/infrastructure/mail/mail.service.ts`

- 신규 메서드 `sendIdRecovery(email: string, loginId: string): Promise<void>`
- 신규 메서드 `sendPasswordRecovery(email: string, password: string): Promise<void>`
- 기존 `sendVerificationCode`의 픽셀/업적 스타일 HTML 템플릿 톤을 유지하되, 인증코드 대신 각각 아이디 / 비밀번호 값을 표시

### `src/auth/auth.controller.ts`

- 신규 라우트 추가:

```typescript
@Post('find-id')
@Throttle({ default: { limit: 3, ttl: 60000 } })
@HttpCode(204)
async findId(@Body() dto: FindIdDto): Promise<void> {
  await this.authService.findId(dto.email);
}

@Post('find-password')
@Throttle({ default: { limit: 3, ttl: 60000 } })
@HttpCode(204)
async findPassword(@Body() dto: FindPasswordDto): Promise<void> {
  await this.authService.findPassword(dto.email);
}
```

### DTO 신규 파일

`src/auth/dto/find-id.dto.ts`

```typescript
import { IsEmail } from 'class-validator';

export class FindIdDto {
  @IsEmail()
  email: string;
}
```

`src/auth/dto/find-password.dto.ts`

```typescript
import { IsEmail } from 'class-validator';

export class FindPasswordDto {
  @IsEmail()
  email: string;
}
```

---

## 구현 순서

1. `FindIdDto`, `FindPasswordDto` 추가
2. `UserService.findByEmail()` 추가
3. `MailService.sendIdRecovery()`, `sendPasswordRecovery()` 추가 (템플릿 포함)
4. `AuthService`: `register()`/`login()` bcrypt 제거 + `findId()`/`findPassword()` 추가
5. `AuthController`: `POST /find-id`, `POST /find-password` 라우트 추가
6. `tsc --noEmit`으로 타입 체크
