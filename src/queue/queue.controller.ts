import { Controller, Get, Param } from '@nestjs/common';
import { QueueService } from './application/queue.service';

/**
 * 출력 파이프라인 작업 상태 조회를 위한 REST 엔드포인트를 제공하는 컨트롤러.
 * 작업 생성/취소는 `/api/prints`(PrintTasksController)에서 처리한다.
 */
@Controller('3d')
export class QueueController {
  constructor(private readonly queueService: QueueService) {}

  /**
   * jobId에 해당하는 출력 파이프라인 작업의 현재 상태를 조회해 반환한다.
   * 채팅 "출력하기" 트리거(`/chats/generate`)가 반환한 jobId를 폴링하는 용도.
   */
  @Get('jobs/:jobId')
  async getJobStatus(@Param('jobId') jobId: string) {
    return this.queueService.getJobStatus(jobId);
  }
}
