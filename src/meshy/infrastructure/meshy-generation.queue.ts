/** Meshy 생성 결과 폴링·업로드를 처리하는 BullMQ 큐 이름. */
export const MESHY_GENERATION_QUEUE = 'meshy-generation';

/** Meshy에 이미 생성된 작업을 폴링해 STL을 업로드하는 Job 데이터. */
export interface MeshyGenerationJobData {
  userId: string;
  kind: 'text' | 'image';
  meshyTaskId: string;
}

export interface MeshyGenerationResult {
  modelUrl: string;
}
