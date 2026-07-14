import { IsNotEmpty, IsString } from 'class-validator';

/**
 * "출력하기" 버튼 클릭 시 전송되는 3D 출력 요청 바디를 검증하는 DTO.
 */
export class ChatGenerateDto {
  /**
   * 3D 모델 생성에 사용할 프롬프트. 프론트엔드가 직접 구성해 전달한다.
   */
  @IsString()
  @IsNotEmpty()
  prompt: string;
}
