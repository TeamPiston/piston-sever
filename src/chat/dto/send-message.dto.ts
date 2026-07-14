import { IsNotEmpty, IsString } from 'class-validator';

/**
 * 채팅 메시지 전송 요청 바디를 검증하는 DTO. 이미지는 @UploadedFile()로 별도 주입된다.
 */
export class SendMessageDto {
  /**
   * 사용자가 AI에게 보내는 메시지 본문.
   */
  @IsString()
  @IsNotEmpty()
  message: string;
}
