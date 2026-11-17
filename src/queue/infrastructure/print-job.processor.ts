import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Job } from 'bullmq';
import { Repository } from 'typeorm';
import { FilesService } from '../../files/application/files.service';
import { OpenscadService } from '../../openscad/application/openscad.service';
import { PrinterService } from '../../printer/application/printer.service';
import { SlicerService } from '../../slicer/application/slicer.service';
import { PrintTask } from '../entities/print-task.entity';

/**
 * 출력 파이프라인 작업을 처리하는 BullMQ 큐의 이름.
 */
export const PRINT_PIPELINE_QUEUE = 'print-pipeline';

/**
 * 출력 파이프라인 작업(job)의 데이터 구조.
 * 현재 진행 단계와 각 단계 산출물 경로를 담아 재시도 시 완료된 단계를 건너뛸 수 있게 한다.
 */
export interface PrintJobData {
  /** 이 작업이 속한 PrintTask(DB) 행의 id. */
  printTaskId: number;
  userId: string;
  /** SCAD 코드 생성에 사용되는 원본 프롬프트(또는 작품명). */
  prompt: string;
  /** 파이프라인의 현재 진행 단계. */
  stage: 'generate' | 'slice' | 'print' | 'printing' | 'done';
  /** 생성된 SCAD 파일 경로 (생성 단계 완료 후 설정). */
  scadPath?: string;
  /** SCAD로부터 변환된 STL 파일 경로 (STL 변환 완료 후 설정). */
  stlPath?: string;
  /** 슬라이싱 결과 G-code 파일 경로 (슬라이싱 완료 후 설정). */
  gcodePath?: string;
  /** MinIO에 업로드된 STL 파일의 공개 URL (STL 업로드 완료 후 설정). */
  modelUrl?: string;
}

const STAGE_PROGRESS: Record<PrintJobData['stage'], number> = {
  generate: 10,
  slice: 40,
  print: 60,
  printing: 70,
  done: 100,
};

/**
 * SCAD 생성 → STL 변환 → 슬라이싱 → 출력으로 이어지는 출력 파이프라인 작업을 처리하는 BullMQ 프로세서.
 * 각 단계 완료 시 job 데이터를 갱신해 재시도 시 이미 완료된 단계를 다시 수행하지 않도록 하고,
 * PrintTask(DB) 행의 진행률/상태도 함께 동기화한다.
 */
@Processor(PRINT_PIPELINE_QUEUE)
export class PrintJobProcessor extends WorkerHost {
  private readonly logger = new Logger(PrintJobProcessor.name);

  constructor(
    private readonly openscadService: OpenscadService,
    private readonly slicerService: SlicerService,
    private readonly printerService: PrinterService,
    private readonly filesService: FilesService,
    @InjectRepository(PrintTask)
    private readonly printTasks: Repository<PrintTask>,
  ) {
    super();
  }

  /**
   * job 데이터의 stage를 기준으로 SCAD 생성/STL 변환, 슬라이싱, 출력을 순서대로 수행한다.
   * 각 단계 완료 후 job 데이터를 갱신하여, 재시도 시 이미 완료된 단계와 중복 출력을 건너뛴다.
   */
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

      let modelUrl: string | undefined;
      try {
        modelUrl = await this.filesService.uploadFile(
          `models/${printTaskId}.stl`,
          stlPath,
        );
      } catch (error) {
        this.logger.error(`[${printTaskId}] STL MinIO 업로드 실패`, error);
      }

      await job.updateData({
        ...job.data,
        stage: 'slice',
        scadPath,
        stlPath,
        modelUrl,
      });
      await this.printTasks.update(printTaskId, {
        progress: STAGE_PROGRESS.slice,
        modelUrl: modelUrl ?? null,
      });
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
