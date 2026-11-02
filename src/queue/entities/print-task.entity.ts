import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

export type PrintTaskStatus = 'PRINTING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';

@Entity('print_tasks')
export class PrintTask {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'user_id', type: 'bigint', unsigned: true })
  userId: string;

  @Column({ name: 'artwork_name', type: 'varchar', length: 255 })
  artworkName: string;

  @Column({ name: 'model_url', type: 'varchar', length: 1024, nullable: true })
  modelUrl: string | null;

  @Column({
    name: 'printer_name',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  printerName: string | null;

  @Column({
    name: 'printing_method',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  printingMethod: string | null;

  @Column({
    name: 'filament_remaining',
    type: 'varchar',
    length: 50,
    nullable: true,
  })
  filamentRemaining: string | null;

  @Column({
    name: 'failure_reason',
    type: 'varchar',
    length: 1024,
    nullable: true,
  })
  failureReason: string | null;

  @Column({
    name: 'stopped_at',
    type: 'datetime',
    precision: 3,
    nullable: true,
  })
  stoppedAt: Date | null;

  @Column({ type: 'varchar', length: 20, default: 'PRINTING' })
  status: PrintTaskStatus;

  @Column({ type: 'int', default: 0 })
  progress: number;

  @Column({ name: 'remaining_minutes', type: 'int', default: 0 })
  remainingMinutes: number;

  @Column({
    name: 'estimated_end_time',
    type: 'varchar',
    length: 64,
    default: '',
  })
  estimatedEndTime: string;

  @CreateDateColumn({
    name: 'created_at',
    type: 'datetime',
    precision: 3,
    default: () => 'CURRENT_TIMESTAMP(3)',
  })
  createdAt: Date;
}
