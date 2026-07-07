import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { OpenscadService } from '../../openscad/application/openscad.service';
import { PrinterService } from '../../printer/application/printer.service';
import { SlicerService } from '../../slicer/application/slicer.service';

export const PRINT_PIPELINE_QUEUE = 'print-pipeline';

export interface PrintJobData {
  jobId: string;
  prompt: string;
  stage: 'generate' | 'slice' | 'print' | 'printing' | 'done';
  scadPath?: string;
  stlPath?: string;
  gcodePath?: string;
}

@Processor(PRINT_PIPELINE_QUEUE)
export class PrintJobProcessor extends WorkerHost {
  private readonly logger = new Logger(PrintJobProcessor.name);

  constructor(
    private readonly openscadService: OpenscadService,
    private readonly slicerService: SlicerService,
    private readonly printerService: PrinterService,
  ) {
    super();
  }

  async process(job: Job<PrintJobData>): Promise<void> {
    const { jobId, prompt } = job.data;
    let { stlPath, gcodePath } = job.data;

    if (job.data.stage === 'done') {
      return;
    }

    // generate → STL (이미 완료된 경우 건너뜀)
    if (!stlPath) {
      this.logger.log(`[${jobId}] SCAD 생성 시작`);
      const scadPath = await this.openscadService.generateScad(prompt, jobId);
      stlPath = await this.openscadService.convertToStl(scadPath, jobId);
      await job.updateData({ ...job.data, stage: 'slice', scadPath, stlPath });
    }

    // slice → G-code (이미 완료된 경우 건너뜀)
    if (!gcodePath) {
      this.logger.log(`[${jobId}] 슬라이싱 시작`);
      gcodePath = await this.slicerService.slice(stlPath, jobId);
      await job.updateData({ ...job.data, stage: 'print', gcodePath });
    }

    // print (이전 시도에서 이미 출력 명령을 보냈다면 중복 출력을 피하기 위해 건너뜀)
    if (job.data.stage === 'printing') {
      this.logger.warn(
        `[${jobId}] 이전 시도에서 이미 출력 명령을 전송했을 수 있어 재출력을 건너뜁니다`,
      );
    } else {
      this.logger.log(`[${jobId}] 출력 시작`);
      await job.updateData({ ...job.data, stage: 'printing' });
      await this.printerService.print(gcodePath);
    }

    await job.updateData({ ...job.data, stage: 'done' });
    this.logger.log(`[${jobId}] 파이프라인 완료`);
  }
}
