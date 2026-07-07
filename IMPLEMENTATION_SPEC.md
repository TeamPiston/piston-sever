# 3D 프린터 파이프라인 구현 스펙

## 결정 사항 요약

| 항목                   | 결정                                                                  |
| ---------------------- | --------------------------------------------------------------------- |
| Queue 방식             | 단일 큐 + 단계별 Job (generate→slice→print)                           |
| 실패 처리              | BullMQ `attempts: 3` 자동 재시도                                      |
| 상태 조회              | `GET /3d/jobs/:jobId` (stage + status 반환)                           |
| 파일 저장              | `OUTPUT_DIR` 환경변수 경로에 영구 보관                                |
| 배포                   | Docker + docker-compose (Redis 포함)                                  |
| OpenSCAD 경로          | `OPENSCAD_BIN` 환경변수 (Dockerfile에 설치, 로컬 맥에서 오버라이드)   |
| CuraEngine 경로        | `CURA_BIN` 환경변수 (Dockerfile에 설치)                               |
| CuraEngine 프로필      | Qidi Max 4 하드코딩 프로필 (`src/slicer/profiles/qidi_max4.def.json`) |
| Moonraker              | `MOONRAKER_URL` 환경변수                                              |
| 폴더 구조              | 모듈별 `domain/application/infrastructure` 분리                       |
| openai 모듈            | OpenAI 클라이언트 Provider만 담당                                     |
| Queue Worker           | `queue` 모듈 단일 Processor에 전체 파이프라인 집중                    |
| API 컨트롤러           | `queue` 모듈에 배치                                                   |
| HardcodedScadGenerator | prompt를 주석으로 포함한 20mm 큐브 반환                               |

---

## 환경변수 목록

```env
# 생성기 선택 (hardcoded | gpt)
SCAD_GENERATOR=hardcoded

# OpenAI (SCAD_GENERATOR=gpt 일 때만 필요)
OPENAI_API_KEY=

# Moonraker
MOONRAKER_URL=http://192.168.x.x:7125

# 파일 저장 경로
OUTPUT_DIR=./output

# 바이너리 경로 (Dockerfile 기본값 사용, 로컬 맥에서 오버라이드)
OPENSCAD_BIN=/usr/bin/openscad
CURA_BIN=/usr/bin/CuraEngine

# Redis
REDIS_HOST=redis
REDIS_PORT=6379
```

---

## 최종 폴더 구조

```
src/
├── openai/
│   ├── openai.module.ts          # OpenAI 클라이언트 Provider export
│   └── openai.provider.ts        # useFactory로 OpenAI 인스턴스 생성
│
├── openscad/
│   ├── domain/
│   │   └── ports/
│   │       └── scad-generator.port.ts        # interface ScadGeneratorPort
│   ├── application/
│   │   └── openscad.service.ts               # SCAD 생성 → STL 변환 오케스트레이션
│   ├── infrastructure/
│   │   └── adapters/
│   │       ├── hardcoded-scad.generator.ts   # HardcodedScadGenerator
│   │       └── gpt-scad.generator.ts         # GptScadGenerator
│   └── openscad.module.ts
│
├── slicer/
│   ├── application/
│   │   └── slicer.service.ts                 # STL → G-code 오케스트레이션
│   ├── infrastructure/
│   │   └── cura-engine.adapter.ts            # CuraEngine CLI 실행
│   ├── profiles/
│   │   └── qidi_max4.def.json                # Qidi Max 4 슬라이싱 프로필
│   └── slicer.module.ts
│
├── printer/
│   ├── application/
│   │   └── printer.service.ts                # G-code 전송 오케스트레이션
│   ├── infrastructure/
│   │   └── moonraker.adapter.ts              # Moonraker REST API 호출
│   └── printer.module.ts
│
├── queue/
│   ├── application/
│   │   └── queue.service.ts                  # Job 추가, 상태 조회
│   ├── infrastructure/
│   │   └── print-job.processor.ts            # BullMQ Processor (전체 파이프라인)
│   ├── queue.controller.ts                   # POST /3d/generate, GET /3d/jobs/:jobId
│   └── queue.module.ts
│
├── app.module.ts
└── main.ts
```

---

## 핵심 인터페이스 및 타입

### ScadGeneratorPort

```typescript
// openscad/domain/ports/scad-generator.port.ts
export interface ScadGeneratorPort {
  generate(prompt: string): Promise<string>;
}
export const SCAD_GENERATOR_PORT = 'SCAD_GENERATOR_PORT';
```

### Job Data 구조

```typescript
// queue 내부에서 사용
interface PrintJobData {
  jobId: string;
  prompt: string;
  stage: 'generate' | 'slice' | 'print';
  scadPath?: string;
  stlPath?: string;
  gcodePath?: string;
}
```

### API 요청/응답

```typescript
// POST /3d/generate
// Request
{ prompt: string }

// Response
{ jobId: string; status: 'queued' }

// GET /3d/jobs/:jobId
// Response
{
  jobId: string;
  status: 'active' | 'completed' | 'failed' | 'waiting';
  stage: 'generate' | 'slice' | 'print';
  failedReason?: string;
}
```

---

## 파이프라인 흐름

```
POST /3d/generate
  └─ QueueService.addJob(prompt)
       └─ BullMQ Queue에 Job 추가 (stage: 'generate')

PrintJobProcessor.process(job)
  ├─ stage === 'generate'
  │    └─ OpenscadService.generateScad(prompt) → {jobId}.scad
  │    └─ OpenscadService.convertToStl({jobId}.scad) → {jobId}.stl
  │    └─ job.updateData({ stage: 'slice', stlPath })
  │    └─ 재귀 처리 (또는 동일 Job에서 다음 단계 실행)
  │
  ├─ stage === 'slice'
  │    └─ SlicerService.slice({jobId}.stl) → {jobId}.gcode
  │    └─ job.updateData({ stage: 'print', gcodePath })
  │
  └─ stage === 'print'
       └─ PrinterService.print({jobId}.gcode)
       └─ 완료
```

> 단일 Processor에서 stage를 switch로 분기하여 순차 처리.
> `attempts: 3`으로 각 단계 실패 시 자동 재시도.

---

## ScadGenerator 교체 방법

`openscad.module.ts`에서 환경변수 `SCAD_GENERATOR`로 동적 선택:

```typescript
{
  provide: SCAD_GENERATOR_PORT,
  useFactory: (openai: OpenAI) => {
    return process.env.SCAD_GENERATOR === 'gpt'
      ? new GptScadGenerator(openai)
      : new HardcodedScadGenerator();
  },
  inject: [OPENAI_CLIENT],
}
```

`.env`에서 `SCAD_GENERATOR=gpt`로 바꾸는 것만으로 구현체 교체 가능.

---

## Docker 구성

### docker-compose.yml 서비스

- `app`: NestJS 앱 (OpenSCAD + CuraEngine 설치된 이미지)
- `redis`: BullMQ용 Redis

### 볼륨

- `./output:/app/output` — 생성 파일 영구 보관

### 환경변수 오버라이드 (로컬 맥 개발)

```env
OPENSCAD_BIN=/Applications/OpenSCAD.app/Contents/MacOS/OpenSCAD
CURA_BIN=/path/to/CuraEngine
REDIS_HOST=localhost
```

---

## 구현 순서

1. `openai` 모듈 — OpenAI Provider
2. `openscad` 모듈 — Port + 두 Adapter + Service (CLI 실행)
3. `slicer` 모듈 — CuraEngine CLI Adapter + Service
4. `printer` 모듈 — Moonraker Adapter + Service
5. `queue` 모듈 — Processor + Service + Controller
6. `app.module.ts` — 전체 모듈 연결
7. `Dockerfile` + `docker-compose.yml`
8. `.env.example`
