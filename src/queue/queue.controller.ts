import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { QueueService } from './application/queue.service';
import { GenerateRequestDto } from './dto/generate-request.dto';

@Controller('3d')
export class QueueController {
  constructor(private readonly queueService: QueueService) {}

  @Post('generate')
  async generate(@Body() dto: GenerateRequestDto) {
    const jobId = await this.queueService.addJob(dto.prompt);
    return { jobId, status: 'queued' };
  }

  @Get('jobs/:jobId')
  async getJobStatus(@Param('jobId') jobId: string) {
    return this.queueService.getJobStatus(jobId);
  }
}
