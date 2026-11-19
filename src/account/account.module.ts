import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { FilesModule } from '../files/files.module';
import { QueueModule } from '../queue/queue.module';
import { AccountController } from './account.controller';
import { AccountService } from './application/account.service';

/**
 * 회원 탈퇴처럼 여러 도메인(인증·출력·파일)에 걸친 계정 작업을 담당하는 모듈.
 * UserModule은 AuthModule에 의존하므로 순환을 피하기 위해 별도 모듈로 둔다.
 */
@Module({
  imports: [AuthModule, QueueModule, FilesModule],
  controllers: [AccountController],
  providers: [AccountService],
})
export class AccountModule {}
