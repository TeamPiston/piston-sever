import { INestApplication, ValidationPipe } from '@nestjs/common';
import { getQueueToken } from '@nestjs/bullmq';
import { Test } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import { Queue } from 'bullmq';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { MESHY_GENERATION_QUEUE } from '../src/meshy/infrastructure/meshy-generation.queue';
import { User } from '../src/user/entities/user.entity';

const PASSWORD = 'e2e-password-1234';

/**
 * CI에는 MESHY_API_KEY가 없어 Meshy 클라이언트가 네트워크 요청 전에 실패한다.
 * 유료 API를 호출하지 않고 비동기 API의 계약과 잠금 해제만 검증한다.
 */
describe('Meshy 비동기 생성 API (e2e, Meshy 호출 없음)', () => {
  let app: INestApplication<App>;
  let accessToken: string;
  let userId: string;

  beforeAll(async () => {
    expect(process.env.MESHY_API_KEY ?? '').toBe('');
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();

    const loginId = `meshy${Date.now()}`;
    const user = await app
      .get(DataSource)
      .getRepository(User)
      .save({
        loginId,
        email: `${loginId}@e2e.test`,
        password: await bcrypt.hash(PASSWORD, 4),
        verified: true,
      });
    userId = user.userId;
    const res = await request(app.getHttpServer())
      .post('/login')
      .send({ id: loginId, password: PASSWORD })
      .expect(200);
    accessToken = (res.body as { accessToken: string }).accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  const api = () => request(app.getHttpServer());

  it('없는 작업 조회는 404', () => {
    return api()
      .get('/meshy/tasks/does-not-exist')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(404);
  });

  it('Meshy 작업 생성이 실패하면 잠금이 풀려 409로 막히지 않는다', async () => {
    for (let i = 0; i < 2; i += 1) {
      await api()
        .post('/meshy/text-to-3d')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ prompt: 'cube' })
        .expect(500);
    }
    const queue = app.get<Queue>(getQueueToken(MESHY_GENERATION_QUEUE));
    const redis = await queue.client;
    expect(await redis.get(`meshy-active:${userId}`)).toBeNull();
    expect(await queue.getJobCounts('waiting', 'active', 'delayed')).toEqual({
      waiting: 0,
      active: 0,
      delayed: 0,
    });
  });
});
