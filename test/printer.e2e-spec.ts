import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { Printer } from '../src/printer/entities/printer.entity';
import { User } from '../src/user/entities/user.entity';

const PASSWORD = 'e2e-password-1234';
const SECRET_FIELDS = ['apiKey', 'accessCode'];

describe('프린터 API 인증값 마스킹 (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let accessToken: string;

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

    const loginId = `printer${Date.now()}`;
    await dataSource.getRepository(User).save({
      loginId,
      email: `${loginId}@e2e.test`,
      password: await bcrypt.hash(PASSWORD, 4),
      verified: true,
    });
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
  const auth = { Authorization: '' };
  const expectNoSecrets = (body: unknown) => {
    for (const field of SECRET_FIELDS) {
      expect(body).not.toHaveProperty(field);
    }
    expect(JSON.stringify(body)).not.toMatch(/secret-key|secret-code/);
  };

  it('등록·조회·수정 응답에 인증값을 내려주지 않고, 생략하면 유지·null이면 삭제한다', async () => {
    auth.Authorization = `Bearer ${accessToken}`;

    const created = await api()
      .post('/printer')
      .set(auth)
      .send({
        name: 'bambu',
        type: 'bambu',
        url: 'http://printer.local',
        apiKey: 'secret-key',
        accessCode: 'secret-code',
        serialNumber: 'SN-1',
      })
      .expect(201);
    expectNoSecrets(created.body);
    const { printerId } = created.body as { printerId: string };
    expect(created.body).toMatchObject({
      hasApiKey: true,
      hasAccessCode: true,
      serialNumber: 'SN-1',
    });

    const list = await api().get('/printer').set(auth).expect(200);
    expectNoSecrets(list.body);
    const one = await api().get(`/printer/${printerId}`).set(auth).expect(200);
    expectNoSecrets(one.body);

    // 인증값을 생략한 수정: 응답과 DB 모두 기존 값 유지
    const renamed = await api()
      .patch(`/printer/${printerId}`)
      .set(auth)
      .send({ name: 'renamed' })
      .expect(200);
    expectNoSecrets(renamed.body);
    expect(renamed.body).toMatchObject({
      name: 'renamed',
      hasApiKey: true,
      hasAccessCode: true,
    });
    const stored = await dataSource
      .getRepository(Printer)
      .findOneByOrFail({ printerId });
    expect(stored.apiKey).toBe('secret-key');
    expect(stored.accessCode).toBe('secret-code');

    // null을 보내면 삭제
    const cleared = await api()
      .patch(`/printer/${printerId}`)
      .set(auth)
      .send({ apiKey: null })
      .expect(200);
    expect(cleared.body).toMatchObject({
      hasApiKey: false,
      hasAccessCode: true,
    });
    const afterClear = await dataSource
      .getRepository(Printer)
      .findOneByOrFail({ printerId });
    expect(afterClear.apiKey).toBeNull();
  });
});
