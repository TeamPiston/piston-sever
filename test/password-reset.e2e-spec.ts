import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { User } from '../src/user/entities/user.entity';

const OLD_PASSWORD = 'old-password-1234';
const NEW_PASSWORD = 'new-password-5678';
const MAILPIT_URL = process.env.MAILPIT_URL ?? 'http://localhost:8025';

/** mailpit에서 수신자에게 온 가장 최근 메일 본문을 기다려 가져온다. */
async function waitForMailText(to: string, after = 0): Promise<string> {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const search = (await (
      await fetch(
        `${MAILPIT_URL}/api/v1/search?query=${encodeURIComponent(`to:"${to}"`)}`,
      )
    ).json()) as { messages: { ID: string }[] };
    if (search.messages.length > after) {
      const message = (await (
        await fetch(`${MAILPIT_URL}/api/v1/message/${search.messages[0].ID}`)
      ).json()) as { Text: string };
      return message.Text;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`${to}로 온 메일이 없습니다.`);
}

function extractToken(text: string): string {
  const match = /비밀번호 재설정 코드: (\S+)/.exec(text);
  if (!match) throw new Error(`재설정 코드를 찾을 수 없음: ${text}`);
  return match[1];
}

describe('비밀번호 재설정·가입 여부 비노출 (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();
    dataSource = app.get(DataSource);
  });

  afterAll(async () => {
    await app.close();
  });

  const api = () => request(app.getHttpServer());
  const login = (id: string, password: string) =>
    api().post('/login').send({ id, password });

  it('가입되지 않은 이메일이어도 아이디·비밀번호 찾기는 204를 반환한다', async () => {
    const email = `nobody${Date.now()}@e2e.test`;
    await api().post('/find-id').send({ email }).expect(204);
    await api().post('/find-password').send({ email }).expect(204);
  });

  it('재설정 요청만으로는 비밀번호가 바뀌지 않고, 코드로 한 번만 변경되며 기존 세션이 폐기된다', async () => {
    const loginId = `reset${Date.now()}`;
    const email = `${loginId}@e2e.test`;
    await dataSource.getRepository(User).save({
      loginId,
      email,
      password: await bcrypt.hash(OLD_PASSWORD, 4),
      verified: true,
    });
    const session = (await login(loginId, OLD_PASSWORD).expect(200)).body as {
      refreshToken: string;
    };

    await api().post('/find-password').send({ email }).expect(204);
    const firstToken = extractToken(await waitForMailText(email));
    // 요청만으로는 기존 비밀번호가 그대로 동작한다.
    await login(loginId, OLD_PASSWORD).expect(200);

    // 새로 요청하면 이전 코드는 무효가 된다.
    await api().post('/find-password').send({ email }).expect(204);
    const token = extractToken(await waitForMailText(email, 1));
    expect(token).not.toBe(firstToken);
    await api()
      .post('/reset-password')
      .send({ token: firstToken, newPassword: NEW_PASSWORD })
      .expect(400);

    await api()
      .post('/reset-password')
      .send({ token, newPassword: NEW_PASSWORD })
      .expect(204);

    await login(loginId, OLD_PASSWORD).expect(401);
    await login(loginId, NEW_PASSWORD).expect(200);
    // 재설정 전 세션의 리프레시 토큰은 폐기됐다.
    await api()
      .post('/reissue')
      .set('Authorization', `Bearer ${session.refreshToken}`)
      .expect(401);
    // 같은 코드는 다시 쓸 수 없다.
    await api()
      .post('/reset-password')
      .send({ token, newPassword: 'another-password-9' })
      .expect(400);
  });
});
