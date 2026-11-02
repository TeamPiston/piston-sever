import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Job } from 'bullmq';
import { Repository } from 'typeorm';
import { OpenscadService } from '../../openscad/application/openscad.service';
import { PrinterService } from '../../printer/application/printer.service';
import { SlicerService } from '../../slicer/application/slicer.service';
import { PrintTask } from '../entities/print-task.entity';

export const PRINT_PIPELINE_QUEUE = 'print-pipeline';

export interface PrintJobData {
  printTaskId: number;
  userId: string;
  prompt: string;
  stage: 'generate' | 'slice' | 'print' | 'printing' | 'done';
  scadPath?: string;
  stlPath?: string;
  gcodePath?: string;
}

const STAGE_PROGRESS: Record<PrintJobData['stage'], number> = {
  generate: 10,
  slice: 40,
  print: 60,
  printing: 70,
  done: 100,
};

@Processor(PRINT_PIPELINE_QUEUE)
export class PrintJobProcessor extends WorkerHost {
  private readonly logger = new Logger(PrintJobProcessor.name);

  constructor(
    private readonly openscadService: OpenscadService,
    private readonly slicerService: SlicerService,
    private readonly printerService: PrinterService,
    @InjectRepository(PrintTask)
    private readonly printTasks: Repository<PrintTask>,
  ) {
    super();
  }

  async process(job: Job<PrintJobData>): Promise<void> {
    const { printTaskId, prompt } = job.data;
    let { stlPath, gcodePath } = job.data;

    if (job.data.stage === 'done') {
      return;
    }

    // generate → STL (이미 완료된 경우 건너뜀)
    if (!stlPath) {
      this.logger.log(`[${printTaskId}] SCAD 생성 시작`);
      const scadPath = await this.openscadService.generateScad(
        prompt,
        String(printTaskId),
      );
      stlPath = await this.openscadService.convertToStl(
        scadPath,
        String(printTaskId),
      );
      await job.updateData({ ...job.data, stage: 'slice', scadPath, stlPath });
      await this.updateProgress(printTaskId, 'slice');
    }

    // slice → G-code (이미 완료된 경우 건너뜀)
    if (!gcodePath) {
      this.logger.log(`[${printTaskId}] 슬라이싱 시작`);
      gcodePath = await this.slicerService.slice(stlPath, String(printTaskId));
      await job.updateData({ ...job.data, stage: 'print', gcodePath });
      await this.updateProgress(printTaskId, 'print');
    }

    // print (이전 시도에서 이미 출력 명령을 보냈다면 중복 출력을 피하기 위해 건너뜀)
    if (job.data.stage === 'printing') {
      this.logger.warn(
        `[${printTaskId}] 이전 시도에서 이미 출력 명령을 전송했을 수 있어 재출력을 건너뜁니다`,
      );
    } else {
      this.logger.log(`[${printTaskId}] 출력 시작`);
      await job.updateData({ ...job.data, stage: 'printing' });
      await this.updateProgress(printTaskId, 'printing');
      await this.printerService.print(gcodePath);
    }

    await job.updateData({ ...job.data, stage: 'done' });
    this.logger.log(`[${printTaskId}] 파이프라인 완료`);
  }

  @OnWorkerEvent('completed')
  async onCompleted(job: Job<PrintJobData>): Promise<void> {
    await this.printTasks.update(job.data.printTaskId, {
      status: 'COMPLETED',
      progress: 100,
      stoppedAt: new Date(),
    });
  }

  @OnWorkerEvent('failed')
  async onFailed(
    job: Job<PrintJobData> | undefined,
    error: Error,
  ): Promise<void> {
    if (!job) return;
    await this.printTasks.update(job.data.printTaskId, {
      status: 'FAILED',
      failureReason: error.message,
      stoppedAt: new Date(),
    });
  }

  private async updateProgress(
    printTaskId: number,
    stage: PrintJobData['stage'],
  ): Promise<void> {
    await this.printTasks.update(printTaskId, {
      progress: STAGE_PROGRESS[stage],
    });
  }
}
