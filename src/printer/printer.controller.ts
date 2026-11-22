import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { PrinterService } from './application/printer.service';
import { CreatePrinterDto } from './dto/create-printer.dto';
import { PrinterResponse, toPrinterResponse } from './dto/printer-response.dto';
import { UpdatePrinterDto } from './dto/update-printer.dto';

@Controller('printer')
export class PrinterController {
  constructor(private readonly printerService: PrinterService) {}

  @Post()
  async create(
    @CurrentUser() user: { userId: string },
    @Body() dto: CreatePrinterDto,
  ): Promise<PrinterResponse> {
    return toPrinterResponse(
      await this.printerService.register(user.userId, dto),
    );
  }

  @Get()
  async findAll(
    @CurrentUser() user: { userId: string },
  ): Promise<PrinterResponse[]> {
    const printers = await this.printerService.findAllByUser(user.userId);
    return printers.map(toPrinterResponse);
  }

  @Get(':id')
  async findOne(
    @CurrentUser() user: { userId: string },
    @Param('id') id: string,
  ): Promise<PrinterResponse> {
    return toPrinterResponse(
      await this.printerService.findOneOwned(user.userId, id),
    );
  }

  @Patch(':id')
  async update(
    @CurrentUser() user: { userId: string },
    @Param('id') id: string,
    @Body() dto: UpdatePrinterDto,
  ): Promise<PrinterResponse> {
    return toPrinterResponse(
      await this.printerService.update(user.userId, id, dto),
    );
  }

  @Delete(':id')
  remove(@CurrentUser() user: { userId: string }, @Param('id') id: string) {
    return this.printerService.remove(user.userId, id);
  }
}
