import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';

/**
 * 애플리케이션 루트 경로 요청을 처리하는 기본 컨트롤러.
 */
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  /**
   * 루트 경로(`GET /`) 요청에 대해 인사말 문자열을 반환한다.
   */
  @Get()
  getHello(): string {
    return this.appService.getHello();
  }
}
