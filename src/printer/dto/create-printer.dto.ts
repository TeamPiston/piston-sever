import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import type { PrinterType } from '../entities/printer.entity';

export class CreatePrinterDto {
  @IsString()
  @MaxLength(100)
  name: string;

  @IsEnum(['moonraker', 'octoprint', 'bambu', 'prusalink'])
  type: PrinterType;

  @IsString()
  @MaxLength(500)
  url: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  apiKey?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  serialNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  accessCode?: string;
}
