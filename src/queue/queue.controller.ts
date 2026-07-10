import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { QueueService } from './application/queue.service';
import { GenerateRequestDto } from './dto/generate-request.dto';

/**
 * 3D 출력 요청 생성 및 작업 상태 조회를 위한 REST 엔드포인트를 제공하는 컨트롤러.
 */
@Controller('3d')
export class QueueController {
  constructor(private readonly queueService: QueueService) {}

  /**
   * 프롬프트를 받아 출력 파이프라인 작업을 큐에 등록하고 생성된 jobId와 큐잉 상태를 반환한다.
   */
  @Post('generate')
  async generate(@Body() dto: GenerateRequestDto) {
    const jobId = await this.queueService.addJob(dto.prompt);
    return { jobId, status: 'queued' };
  }

  /**
   * jobId에 해당하는 출력 파이프라인 작업의 현재 상태를 조회해 반환한다.
   */
  @Get('jobs/:jobId')
  async getJobStatus(@Param('jobId') jobId: string) {
    return this.queueService.getJobStatus(jobId);
  }
}
