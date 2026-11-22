import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import {
  MeshyGenerationTaskResponse,
  MeshyService,
} from './application/meshy.service';
import { TextTo3dDto } from './dto/text-to-3d.dto';

const ALLOWED_IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

/**
 * Meshy 3D 생성 API. 생성 요청은 202로 바로 taskId를 돌려주고,
 * 결과는 `GET /meshy/tasks/:taskId`로 조회한다(사용자당 동시 1건).
 */
@Controller('meshy')
export class MeshyController {
  constructor(private readonly meshyService: MeshyService) {}

  @Post('text-to-3d')
  @HttpCode(202)
  textTo3d(
    @CurrentUser() user: { userId: string },
    @Body() dto: TextTo3dDto,
  ): Promise<{ taskId: string }> {
    return this.meshyService.startFromText(user.userId, dto.prompt);
  }

  @Post('image-to-3d')
  @HttpCode(202)
  @UseInterceptors(
    FileInterceptor('image', {
      storage: memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 },
      fileFilter: (_req, file, callback) => {
        callback(null, ALLOWED_IMAGE_MIME_TYPES.includes(file.mimetype));
      },
    }),
  )
  imageTo3d(
    @CurrentUser() user: { userId: string },
    @UploadedFile() image?: Express.Multer.File,
  ): Promise<{ taskId: string }> {
    if (!image) {
      throw new BadRequestException('이미지 파일이 필요합니다.');
    }
    return this.meshyService.startFromImage(
      user.userId,
      image.buffer,
      image.mimetype,
    );
  }

  @Get('tasks/:taskId')
  getTask(
    @CurrentUser() user: { userId: string },
    @Param('taskId') taskId: string,
  ): Promise<MeshyGenerationTaskResponse> {
    return this.meshyService.getTask(user.userId, taskId);
  }
}
