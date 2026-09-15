import axios from 'axios';
import { PrinterPort } from '../../domain/ports/printer.port';

export class PrusaLinkAdapter implements PrinterPort {
  constructor(
    private readonly url: string,
    private readonly apiKey: string,
  ) {}

  async uploadGcode(gcode: Buffer, filename: string): Promise<void> {
    await axios.put(`${this.url}/api/v1/files/local/${filename}`, gcode, {
      headers: {
        'X-Api-Key': this.apiKey,
        'Content-Type': 'application/octet-stream',
        'Print-After-Upload': '?0',
        Overwrite: '?1',
      },
    });
  }

  async startPrint(filename: string): Promise<void> {
    await axios.post(`${this.url}/api/v1/files/local/${filename}`, undefined, {
      headers: { 'X-Api-Key': this.apiKey },
    });
  }

  async getStatus(): Promise<string> {
    try {
      const response = await axios.get<{ printer?: { state?: string } }>(
        `${this.url}/api/v1/status`,
        {
          headers: { 'X-Api-Key': this.apiKey },
          timeout: 5000,
        },
      );
      return response.data.printer?.state ?? 'unknown';
    } catch {
      return 'offline';
    }
  }
}
