import { BadRequestException, Injectable } from '@nestjs/common';
import { Printer } from '../entities/printer.entity';
import { PrinterPort } from '../domain/ports/printer.port';
import { BambuAdapter } from './adapters/bambu.adapter';
import { MoonrakerAdapter } from './adapters/moonraker.adapter';
import { OctoPrintAdapter } from './adapters/octoprint.adapter';
import { PrusaLinkAdapter } from './adapters/prusalink.adapter';

@Injectable()
export class PrinterAdapterFactory {
  create(printer: Printer): PrinterPort {
    switch (printer.type) {
      case 'moonraker':
        return new MoonrakerAdapter(printer.url);
      case 'octoprint':
        return new OctoPrintAdapter(printer.url, printer.apiKey ?? '');
      case 'bambu':
        return new BambuAdapter(
          printer.url,
          printer.serialNumber ?? '',
          printer.accessCode ?? '',
        );
      case 'prusalink':
        return new PrusaLinkAdapter(printer.url, printer.apiKey ?? '');
      default:
        throw new BadRequestException(
          `지원하지 않는 프린터 타입입니다: ${String(printer.type)}`,
        );
    }
  }
}
