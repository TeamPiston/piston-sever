import { DataSource } from 'typeorm';
import { AuthService } from '../../auth/application/auth.service';
import { ChatMessage } from '../../chat/entities/chat-message.entity';
import { FilesService } from '../../files/application/files.service';
import { Printer } from '../../printer/entities/printer.entity';
import { QueueService } from '../../queue/application/queue.service';
import { PrintTask } from '../../queue/entities/print-task.entity';
import { User } from '../../user/entities/user.entity';
import { AccountService } from './account.service';

describe('AccountService.deleteAccount', () => {
  const userId = '42';
  const calls: string[] = [];
  let manager: { delete: jest.Mock };
  let dataSource: DataSource;
  let queueService: { cancelPrintTask: jest.Mock };
  let authService: { revokeAllSessions: jest.Mock };
  let filesService: { removeObjects: jest.Mock; removeByPrefix: jest.Mock };
  let service: AccountService;

  beforeEach(() => {
    calls.length = 0;
    manager = {
      delete: jest.fn((entity: { name: string }) => {
        calls.push(`delete:${entity.name}`);
        return Promise.resolve();
      }),
    };
    dataSource = {
      getRepository: () => ({
        find: () =>
          Promise.resolve([
            { id: 1, status: 'PRINTING' },
            { id: 2, status: 'COMPLETED' },
          ]),
      }),
      transaction: (fn: (m: typeof manager) => Promise<void>) => fn(manager),
    } as unknown as DataSource;
    queueService = {
      cancelPrintTask: jest.fn(() => {
        calls.push('cancel');
        return Promise.resolve();
      }),
    };
    authService = {
      revokeAllSessions: jest.fn(() => {
        calls.push('revoke');
        return Promise.resolve();
      }),
    };
    filesService = {
      removeObjects: jest.fn(() => Promise.resolve()),
      removeByPrefix: jest.fn(() => Promise.resolve()),
    };
    service = new AccountService(
      dataSource,
      queueService as unknown as QueueService,
      authService as unknown as AuthService,
      filesService as unknown as FilesService,
    );
  });

  it('진행 중인 출력만 취소하고, 세션 폐기 후 사용자 데이터를 삭제한다', async () => {
    await service.deleteAccount(userId);

    expect(queueService.cancelPrintTask).toHaveBeenCalledTimes(1);
    expect(queueService.cancelPrintTask).toHaveBeenCalledWith(userId, 1);
    expect(authService.revokeAllSessions).toHaveBeenCalledWith(userId);
    expect(calls).toEqual([
      'cancel',
      'revoke',
      `delete:${ChatMessage.name}`,
      `delete:${PrintTask.name}`,
      `delete:${Printer.name}`,
      `delete:${User.name}`,
    ]);
    for (const [, criteria] of manager.delete.mock.calls) {
      expect(criteria).toEqual({ userId });
    }
  });

  it('사용자의 모델 파일과 채팅 이미지를 삭제한다', async () => {
    await service.deleteAccount(userId);

    expect(filesService.removeObjects).toHaveBeenCalledWith([
      'models/1.stl',
      'models/2.stl',
    ]);
    expect(filesService.removeByPrefix).toHaveBeenCalledWith('chat/42/');
  });

  it('파일 삭제가 실패해도 탈퇴는 성공한다', async () => {
    filesService.removeObjects.mockRejectedValue(new Error('minio down'));

    await expect(service.deleteAccount(userId)).resolves.toBeUndefined();
    expect(calls).toContain(`delete:${User.name}`);
  });

  it('세션 폐기가 실패하면 DB 데이터를 지우지 않는다', async () => {
    authService.revokeAllSessions.mockRejectedValue(new Error('redis down'));

    await expect(service.deleteAccount(userId)).rejects.toThrow('redis down');
    expect(manager.delete).not.toHaveBeenCalled();
  });
});
