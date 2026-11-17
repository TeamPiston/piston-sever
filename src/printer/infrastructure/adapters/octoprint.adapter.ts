import axios from 'axios';
import FormData from 'form-data';
import { PrinterPort } from '../../domain/ports/printer.port';

export class OctoPrintAdapter implements PrinterPort {
  constructor(
    private readonly url: string,
    private readonly apiKey: string,
  ) {}

  async uploadGcode(gcode: Buffer, filename: string): Promise<void> {
    const formData = new FormData();
    formData.append('file', gcode, filename);
    await axios.post(`${this.url}/api/files/local`, formData, {
      headers: { ...formData.getHeaders(), 'X-Api-Key': this.apiKey },
    });
  }

  async startPrint(filename: string): Promise<void> {
    await axios.post(
      `${this.url}/api/files/local/${filename}`,
      { command: 'select', print: true },
      { headers: { 'X-Api-Key': this.apiKey } },
    );
  }

  async getStatus(): Promise<string> {
    try {
      const response = await axios.get<{ state?: { text?: string } }>(
        `${this.url}/api/printer`,
        {
          headers: { 'X-Api-Key': this.apiKey },
          timeout: 5000,
        },
      );
      return response.data.state?.text ?? 'unknown';
    } catch {
      return 'offline';
    }
  }
}
