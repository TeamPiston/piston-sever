import { IsNotEmpty, IsString } from 'class-validator';

/**
 * 3D 출력물 생성 요청 바디를 검증하는 DTO.
 */
export class GenerateRequestDto {
  /**
   * 생성할 모델을 설명하는 프롬프트. 빈 문자열은 허용되지 않는다.
   */
  @IsString()
  @IsNotEmpty()
  prompt: string;
}
