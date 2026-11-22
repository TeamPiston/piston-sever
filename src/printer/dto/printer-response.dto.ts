import type {
  Printer,
  PrinterStatus,
  PrinterType,
} from '../entities/printer.entity';

/**
 * 프린터 API 응답. 프린터를 직접 제어할 수 있는 인증값(apiKey, accessCode)은
 * 내려주지 않고 설정 여부만 알려준다.
 */
export interface PrinterResponse {
  printerId: string;
  userId: string;
  name: string;
  type: PrinterType;
  url: string;
  serialNumber: string | null;
  hasApiKey: boolean;
  hasAccessCode: boolean;
  status: PrinterStatus;
  createdAt: Date;
  updatedAt: Date;
}

export function toPrinterResponse(printer: Printer): PrinterResponse {
  return {
    printerId: printer.printerId,
    userId: printer.userId,
    name: printer.name,
    type: printer.type,
    url: printer.url,
    serialNumber: printer.serialNumber ?? null,
    hasApiKey: Boolean(printer.apiKey),
    hasAccessCode: Boolean(printer.accessCode),
    status: printer.status,
    createdAt: printer.createdAt,
    updatedAt: printer.updatedAt,
  };
}
