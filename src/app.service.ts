import { Injectable } from '@nestjs/common';

/**
 * 애플리케이션 전역 헬스체크/샘플용 서비스.
 */
@Injectable()
export class AppService {
  /**
   * 고정된 인사말 문자열 `'Hello World!'`를 반환한다.
   */
  getHello(): string {
    return 'Hello World!';
  }
}
