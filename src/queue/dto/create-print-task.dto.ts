import { IsNotEmpty, IsString } from 'class-validator';

export class CreatePrintTaskDto {
  @IsString()
  @IsNotEmpty()
  artworkName: string;
}
