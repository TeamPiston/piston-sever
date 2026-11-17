import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../user/entities/user.entity';

export type PrinterType = 'moonraker' | 'octoprint' | 'bambu' | 'prusalink';
export type PrinterStatus = 'online' | 'offline';

@Entity('printers')
export class Printer {
  @PrimaryGeneratedColumn({ type: 'bigint', name: 'printer_id' })
  printerId: string;

  @Column({ name: 'user_id', type: 'bigint' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({
    type: 'enum',
    enum: ['moonraker', 'octoprint', 'bambu', 'prusalink'],
  })
  type: PrinterType;

  @Column({ type: 'varchar', length: 500 })
  url: string;

  @Column({ name: 'api_key', type: 'varchar', length: 255, nullable: true })
  apiKey: string | null;

  @Column({
    name: 'serial_number',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  serialNumber: string | null;

  @Column({
    name: 'access_code',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  accessCode: string | null;

  @Column({ type: 'enum', enum: ['online', 'offline'], default: 'offline' })
  status: PrinterStatus;

  @CreateDateColumn({
    name: 'created_at',
    type: 'timestamp',
    precision: 3,
    default: () => 'CURRENT_TIMESTAMP(3)',
  })
  createdAt: Date;

  @UpdateDateColumn({
    name: 'updated_at',
    type: 'timestamp',
    precision: 3,
    default: () => 'CURRENT_TIMESTAMP(3)',
  })
  updatedAt: Date;
}
