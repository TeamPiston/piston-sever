export interface PrinterPort {
  uploadGcode(gcode: Buffer, filename: string): Promise<void>;
  startPrint(filename: string): Promise<void>;
  getStatus(): Promise<string>;
}
