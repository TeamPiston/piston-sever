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
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { QueueService } from './application/queue.service';
import { CreatePrintTaskDto } from './dto/create-print-task.dto';

@Controller('api/prints')
export class PrintTasksController {
  constructor(private readonly queueService: QueueService) {}

  @Post()
  create(
    @CurrentUser() user: { userId: string },
    @Body() dto: CreatePrintTaskDto,
  ) {
    return this.queueService.createPrintTask(user.userId, dto.artworkName);
  }

  @Get('current')
  getCurrent(@CurrentUser() user: { userId: string }) {
    return this.queueService.getCurrentPrintTask(user.userId);
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
