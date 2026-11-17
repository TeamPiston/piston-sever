import { IsString, MaxLength, MinLength } from 'class-validator';

export class TextTo3dDto {
  @IsString()
  @MinLength(1)
  @MaxLength(600)
  prompt: string;
}
