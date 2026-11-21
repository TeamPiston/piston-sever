import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { QueueService } from './application/queue.service';
import { CreatePrintTaskDto } from './dto/create-print-task.dto';

@Controller('api/prints')
export class PrintTasksController {
  constructor(private readonly queueService: QueueService) {}

  @Post()
  async create(
    @CurrentUser() user: { userId: string },
    @Body() dto: CreatePrintTaskDto,
  ) {
    const { printTask } = await this.queueService.createPrintTask(
      user.userId,
      dto.artworkName,
    );
    return printTask;
  }

  @Get('current')
  async getCurrent(
    @CurrentUser() user: { userId: string },
    @Res() res: Response,
  ): Promise<void> {
    // Nest는 null 반환을 빈 본문으로 보내므로, 계약(PrintTask | null)대로 JSON으로 직접 응답한다.
    res.json(await this.queueService.getCurrentPrintTask(user.userId));
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async cancel(
    @CurrentUser() user: { userId: string },
    @Param('id', ParseIntPipe) id: number,
  ) {
    await this.queueService.cancelPrintTask(user.userId, id);
  }
}
