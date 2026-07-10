import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { OpenscadService } from '../../openscad/application/openscad.service';
import { PrinterService } from '../../printer/application/printer.service';
import { SlicerService } from '../../slicer/application/slicer.service';

/**
 * 출력 파이프라인 작업을 처리하는 BullMQ 큐의 이름.
 */
export const PRINT_PIPELINE_QUEUE = 'print-pipeline';

/**
 * 출력 파이프라인 작업(job)의 데이터 구조.
 * 현재 진행 단계와 각 단계 산출물 경로를 담아 재시도 시 완료된 단계를 건너뛸 수 있게 한다.
 */
export interface PrintJobData {
  /** 작업을 식별하는 고유 ID. */
  jobId: string;
  /** SCAD 코드 생성에 사용되는 원본 프롬프트. */
  prompt: string;
  /** 파이프라인의 현재 진행 단계. */
  stage: 'generate' | 'slice' | 'print' | 'printing' | 'done';
  /** 생성된 SCAD 파일 경로 (생성 단계 완료 후 설정). */
  scadPath?: string;
  /** SCAD로부터 변환된 STL 파일 경로 (STL 변환 완료 후 설정). */
  stlPath?: string;
  /** 슬라이싱 결과 G-code 파일 경로 (슬라이싱 완료 후 설정). */
  gcodePath?: string;
}

/**
 * SCAD 생성 → STL 변환 → 슬라이싱 → 출력으로 이어지는 출력 파이프라인 작업을 처리하는 BullMQ 프로세서.
 * 각 단계 완료 시 job 데이터를 갱신해 재시도 시 이미 완료된 단계를 다시 수행하지 않도록 한다.
 */
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

  /**
   * job 데이터의 stage를 기준으로 SCAD 생성/STL 변환, 슬라이싱, 출력을 순서대로 수행한다.
   * 각 단계 완료 후 job 데이터를 갱신하여, 재시도 시 이미 완료된 단계와 중복 출력을 건너뛴다.
   */
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
