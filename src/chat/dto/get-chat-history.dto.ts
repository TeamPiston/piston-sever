import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

/**
 * 채팅 히스토리 커서 페이지네이션 조회 쿼리를 검증하는 DTO.
 */
export class GetChatHistoryDto {
  /**
   * 이전 페이지 마지막 chatId. 첫 요청 시 생략하면 최신 메시지부터 조회한다.
   */
  @IsOptional()
  @IsString()
  cursor?: string;

  /**
   * 한 페이지에 조회할 메시지 개수.
   */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  size: number = 30;
}
