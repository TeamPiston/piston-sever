import axios from 'axios';
import FormData from 'form-data';
import { PrinterPort } from '../../domain/ports/printer.port';

export class MoonrakerAdapter implements PrinterPort {
  constructor(private readonly url: string) {}

  async uploadGcode(gcode: Buffer, filename: string): Promise<void> {
    const formData = new FormData();
    formData.append('file', gcode, filename);
    await axios.post(`${this.url}/server/files/upload`, formData, {
      headers: formData.getHeaders(),
    });
  }

  async startPrint(filename: string): Promise<void> {
    await axios.post(`${this.url}/printer/print/start`, { filename });
  }

  async getStatus(): Promise<string> {
    try {
      const response = await axios.get<{ result?: { state?: string } }>(
        `${this.url}/printer/info`,
        { timeout: 5000 },
      );
      return response.data.result?.state ?? 'unknown';
    } catch {
      return 'offline';
    }
  }
}
