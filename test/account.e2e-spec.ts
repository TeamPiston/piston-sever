import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import Redis from 'ioredis';
import { Client } from 'minio';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { REDIS_CLIENT } from '../src/auth/infrastructure/redis/redis.provider';
import { ChatMessage } from '../src/chat/entities/chat-message.entity';
import { FilesService } from '../src/files/application/files.service';
import { MINIO_CLIENT } from '../src/files/infrastructure/minio-client.provider';
import { Printer } from '../src/printer/entities/printer.entity';
import { PrintTask } from '../src/queue/entities/print-task.entity';
import { User } from '../src/user/entities/user.entity';

const PASSWORD = 'e2e-password-1234';
const BUCKET = process.env.MINIO_BUCKET ?? 'piston-files';

describe('DELETE /api/users/me (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let redis: Redis;
  let minio: Client;
  let files: FilesService;

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
    redis = app.get<Redis>(REDIS_CLIENT);
    minio = app.get<Client>(MINIO_CLIENT);
    files = app.get(FilesService);
  });

  afterAll(async () => {
    await app.close();
    redis.disconnect();
  });

  async function seedUser(loginId: string) {
    const user = await dataSource.getRepository(User).save({
      loginId,
      email: `${loginId}@e2e.test`,
      password: await bcrypt.hash(PASSWORD, 4),
      verified: true,
    });
    const userId = user.userId;
    const tasks = await dataSource.getRepository(PrintTask).save([
      { userId, artworkName: 'done', status: 'COMPLETED' as const },
      { userId, artworkName: 'running', status: 'PRINTING' as const },
    ]);
    await dataSource.getRepository(ChatMessage).save({
      userId,
      role: 'USER',
      message: 'hello',
      imageUrl: null,
      jobId: null,
    });
    await dataSource.getRepository(Printer).save({
      userId,
      name: 'printer',
      type: 'moonraker',
      url: 'http://printer.local',
    });
    const keys = [
      `chat/${userId}/a.png`,
      ...tasks.map((task) => `models/${task.id}.stl`),
    ];
    for (const key of keys) {
      await files.uploadBuffer(
        key,
        Buffer.from('x'),
        'application/octet-stream',
      );
    }

    const res = await request(app.getHttpServer())
      .post('/login')
      .send({ id: loginId, password: PASSWORD })
      .expect(200);
    const tokens = res.body as { accessToken: string; refreshToken: string };
    return { userId, keys, tokens };
  }

  async function objectExists(key: string): Promise<boolean> {
    try {
      await minio.statObject(BUCKET, key);
      return true;
    } catch {
      return false;
    }
  }

  async function countOwned(userId: string) {
    return Promise.all([
      dataSource.getRepository(User).countBy({ userId }),
      dataSource.getRepository(ChatMessage).countBy({ userId }),
      dataSource.getRepository(PrintTask).countBy({ userId }),
      dataSource.getRepository(Printer).countBy({ userId }),
      redis.keys(`refresh-token:${userId}:*`).then((k) => k.length),
    ]);
  }

  it('토큰 없이 호출하면 401', () => {
    return request(app.getHttpServer()).delete('/api/users/me').expect(401);
  });

  it('본인 데이터·세션·파일만 삭제하고 다른 사용자는 건드리지 않는다', async () => {
    const victim = await seedUser(`victim${Date.now()}`);
    const other = await seedUser(`other${Date.now()}`);

    await request(app.getHttpServer())
      .delete('/api/users/me')
      .set('Authorization', `Bearer ${victim.tokens.accessToken}`)
      .expect(204);

    expect(await countOwned(victim.userId)).toEqual([0, 0, 0, 0, 0]);
    expect(await countOwned(other.userId)).toEqual([1, 1, 2, 1, 1]);

    for (const key of victim.keys) {
      expect(await objectExists(key)).toBe(false);
    }
    for (const key of other.keys) {
      expect(await objectExists(key)).toBe(true);
    }

    await request(app.getHttpServer())
      .post('/reissue')
      .set('Authorization', `Bearer ${victim.tokens.refreshToken}`)
      .expect(401);
  });
});
