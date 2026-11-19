import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AuthService } from '../../auth/application/auth.service';
import { ChatMessage } from '../../chat/entities/chat-message.entity';
import { FilesService } from '../../files/application/files.service';
import { Printer } from '../../printer/entities/printer.entity';
import { QueueService } from '../../queue/application/queue.service';
import { PrintTask } from '../../queue/entities/print-task.entity';
import { User } from '../../user/entities/user.entity';

/**
 * 회원 탈퇴 시 사용자에게 속한 출력 작업, 세션, DB 데이터, 업로드 파일을 정리하는 서비스.
 */
@Injectable()
export class AccountService {
  private readonly logger = new Logger(AccountService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly queueService: QueueService,
    private readonly authService: AuthService,
    private readonly filesService: FilesService,
  ) {}

  /**
   * 진행 중인 출력을 취소하고 모든 세션을 폐기한 뒤, 사용자 데이터를 한 트랜잭션으로 삭제한다.
   * 업로드 파일 정리는 계정 삭제 이후 best-effort로 수행한다.
   */
  async deleteAccount(userId: string): Promise<void> {
    const printTasks = await this.dataSource.getRepository(PrintTask).find({
      where: { userId },
      select: { id: true, status: true },
    });

    for (const task of printTasks) {
      if (task.status === 'PRINTING') {
        await this.queueService.cancelPrintTask(userId, task.id);
      }
    }

    await this.authService.revokeAllSessions(userId);

    await this.dataSource.transaction(async (manager) => {
      await manager.delete(ChatMessage, { userId });
      await manager.delete(PrintTask, { userId });
      await manager.delete(Printer, { userId });
      await manager.delete(User, { userId });
    });

    try {
      await this.filesService.removeObjects(
        printTasks.map((task) => `models/${task.id}.stl`),
      );
      await this.filesService.removeByPrefix(`chat/${userId}/`);
    } catch (error) {
      this.logger.error(`[${userId}] 탈퇴 사용자 파일 삭제 실패`, error);
    }
  }
}
