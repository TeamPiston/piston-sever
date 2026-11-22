import { ValidationPipe } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { resolveTrustProxy } from '../src/trust-proxy';

describe('리버스 프록시 뒤 레이트 리밋 (e2e)', () => {
  let app: NestExpressApplication;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication<NestExpressApplication>();
    // 테스트 요청은 loopback에서 오므로 loopback을 신뢰할 프록시로 지정한다.
    app.set('trust proxy', resolveTrustProxy('loopback'));
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  // 잘못된 이메일이라 메일은 발송되지 않고, 가드(스로틀)가 파이프(검증)보다 먼저 실행된다.
  const sendFrom = (clientIp: string) =>
    request(app.getHttpServer())
      .post('/send')
      .set('X-Forwarded-For', clientIp)
      .send({ email: 'not-an-email' });

  it('사용자(X-Forwarded-For)별로 /send 제한(1분 3회)을 따로 센다', async () => {
    for (let i = 0; i < 3; i += 1) {
      await sendFrom('198.51.100.1').expect(400);
    }
    await sendFrom('198.51.100.1').expect(429);

    // 같은 프록시를 거친 다른 사용자는 제한에 걸리지 않는다.
    await sendFrom('198.51.100.2').expect(400);
  });
});
