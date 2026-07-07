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
  stage: 'generate' | 'slice' | 'print' | 'done';
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

    // generate → STL (이미 완료된 경우 건너뜀)
    if (!stlPath) {
      await job.updateData({ ...job.data, stage: 'generate' });
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

    // print
    this.logger.log(`[${jobId}] 출력 시작`);
    await this.printerService.print(gcodePath);
    await job.updateData({ ...job.data, stage: 'done' });
    this.logger.log(`[${jobId}] 파이프라인 완료`);
  }
}
