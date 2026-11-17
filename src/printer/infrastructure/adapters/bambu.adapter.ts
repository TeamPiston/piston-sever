import { Client as FtpClient } from 'basic-ftp';
import mqtt from 'mqtt';
import { Readable } from 'stream';
import { PrinterPort } from '../../domain/ports/printer.port';

export class BambuAdapter implements PrinterPort {
  constructor(
    private readonly url: string,
    private readonly serialNumber: string,
    private readonly accessCode: string,
  ) {}

  async uploadGcode(gcode: Buffer, filename: string): Promise<void> {
    const client = new FtpClient();
    try {
      await client.access({
        host: this.url,
        port: 990,
        user: 'bblp',
        password: this.accessCode,
        secure: 'implicit',
        secureOptions: { rejectUnauthorized: false },
      });
      await client.uploadFrom(Readable.from(gcode), filename);
    } finally {
      client.close();
    }
  }

  async startPrint(filename: string): Promise<void> {
    await this.publish({
      print: {
        sequence_id: '0',
        command: 'project_file',
        param: `Metadata/${filename}`,
        subtask_name: filename,
        url: `file:///sdcard/${filename}`,
        use_ams: false,
      },
    });
  }

  async getStatus(): Promise<string> {
    return new Promise((resolve) => {
      const client = this.connect();
      const timeout = setTimeout(() => {
        client.end(true);
        resolve('offline');
      }, 5000);

      client.on('connect', () => {
        client.subscribe(`device/${this.serialNumber}/report`);
        client.publish(
          `device/${this.serialNumber}/request`,
          JSON.stringify({ pushing: { sequence_id: '0', command: 'pushall' } }),
        );
      });

      client.on('message', (_topic, payload) => {
        clearTimeout(timeout);
        try {
          const data = JSON.parse(payload.toString()) as {
            print?: { gcode_state?: string };
          };
          resolve(data.print?.gcode_state ?? 'unknown');
        } catch {
          resolve('unknown');
        } finally {
          client.end(true);
        }
      });

      client.on('error', () => {
        clearTimeout(timeout);
        client.end(true);
        resolve('offline');
      });
    });
  }

  private publish(payload: Record<string, unknown>): Promise<void> {
    return new Promise((resolve, reject) => {
      const client = this.connect();
      const timeout = setTimeout(() => {
        client.end(true);
        reject(new Error('Bambu 프린터 응답 시간이 초과되었습니다.'));
      }, 5000);

      client.on('connect', () => {
        client.publish(
          `device/${this.serialNumber}/request`,
          JSON.stringify(payload),
          (error) => {
            clearTimeout(timeout);
            client.end(true);
            if (error) {
              reject(error);
            } else {
              resolve();
            }
          },
        );
      });

      client.on('error', (error) => {
        clearTimeout(timeout);
        client.end(true);
        reject(error);
      });
    });
  }

  private connect() {
    return mqtt.connect(`mqtts://${this.url}:8883`, {
      username: 'bblp',
      password: this.accessCode,
      rejectUnauthorized: false,
      connectTimeout: 5000,
    });
  }
}
