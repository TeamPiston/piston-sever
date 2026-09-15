import {
  BadRequestException,
  Body,
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { MeshyService } from './application/meshy.service';
import { TextTo3dDto } from './dto/text-to-3d.dto';

const ALLOWED_IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

@Controller('meshy')
export class MeshyController {
  constructor(private readonly meshyService: MeshyService) {}

  @Post('text-to-3d')
  textTo3d(@CurrentUser() user: { userId: string }, @Body() dto: TextTo3dDto) {
    return this.meshyService.generateFromText(user.userId, dto.prompt);
  }

  @Post('image-to-3d')
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
  ) {
    if (!image) {
      throw new BadRequestException('이미지 파일이 필요합니다.');
    }
    return this.meshyService.generateFromImage(
      user.userId,
      image.buffer,
      image.mimetype,
    );
  }
}
