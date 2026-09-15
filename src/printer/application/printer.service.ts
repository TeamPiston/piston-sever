import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import * as fs from 'fs/promises';
import * as path from 'path';
import { Repository } from 'typeorm';
import { CreatePrinterDto } from '../dto/create-printer.dto';
import { UpdatePrinterDto } from '../dto/update-printer.dto';
import { Printer } from '../entities/printer.entity';
import { MoonrakerAdapter } from '../infrastructure/adapters/moonraker.adapter';
import { PrinterAdapterFactory } from '../infrastructure/printer-adapter.factory';

@Injectable()
export class PrinterService {
  private readonly logger = new Logger(PrinterService.name);

  constructor(
    @InjectRepository(Printer)
    private readonly printerRepository: Repository<Printer>,
    private readonly adapterFactory: PrinterAdapterFactory,
    private readonly configService: ConfigService,
  ) {}

  async register(userId: string, dto: CreatePrinterDto): Promise<Printer> {
    const printer = this.printerRepository.create({
      ...dto,
      userId,
      status: 'offline',
    });
    return this.printerRepository.save(printer);
  }

  async findAllByUser(userId: string): Promise<Printer[]> {
    return this.printerRepository.find({ where: { userId } });
  }

  async findOneOwned(userId: string, printerId: string): Promise<Printer> {
    const printer = await this.printerRepository.findOne({
      where: { printerId },
    });
    if (!printer) {
      throw new NotFoundException('프린터를 찾을 수 없습니다.');
    }
    if (printer.userId !== userId) {
      throw new ForbiddenException('해당 프린터에 접근할 수 없습니다.');
    }
    return printer;
  }

  async update(
    userId: string,
    printerId: string,
    dto: UpdatePrinterDto,
  ): Promise<Printer> {
    const printer = await this.findOneOwned(userId, printerId);
    Object.assign(printer, dto);
    return this.printerRepository.save(printer);
  }

  async remove(userId: string, printerId: string): Promise<void> {
    const printer = await this.findOneOwned(userId, printerId);
    await this.printerRepository.remove(printer);
  }

  async getStatus(userId: string, printerId: string): Promise<string> {
    const printer = await this.findOneOwned(userId, printerId);
    const adapter = this.adapterFactory.create(printer);
    return adapter.getStatus();
  }

  async printOnPrinter(
    userId: string,
    printerId: string,
    gcodePath: string,
  ): Promise<void> {
    const printer = await this.findOneOwned(userId, printerId);
    const adapter = this.adapterFactory.create(printer);
    const gcode = await fs.readFile(gcodePath);
    const filename = path.basename(gcodePath);
    this.logger.log(`[${printer.name}] 출력 준비: ${filename}`);
    await adapter.uploadGcode(gcode, filename);
    await adapter.startPrint(filename);
    this.logger.log(`[${printer.name}] 출력 시작: ${filename}`);
  }

  async print(gcodePath: string): Promise<void> {
    const moonrakerUrl = this.configService.get<string>('MOONRAKER_URL', '');
    if (!moonrakerUrl) {
      throw new Error('MOONRAKER_URL이 설정되지 않았습니다.');
    }
    const adapter = new MoonrakerAdapter(moonrakerUrl);
    const gcode = await fs.readFile(gcodePath);
    const filename = path.basename(gcodePath);
    this.logger.log(`출력 준비: ${filename}`);
    await adapter.uploadGcode(gcode, filename);
    await adapter.startPrint(filename);
    this.logger.log(`출력 시작: ${filename}`);
  }
}
