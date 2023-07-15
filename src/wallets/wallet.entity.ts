import {
  Entity,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  PrimaryGeneratedColumn,
  ManyToOne,
  BaseEntity,
  JoinColumn,
} from 'typeorm';
import { User } from '../users/user.entity';

export enum Currency {
  NGN = 'NGN',
  USD = 'USD',
  GHS = 'GHS',
}

@Entity({ name: 'wallets' })
export class Wallet extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  user_id: string;

  @Column({ name: 'balance', nullable: false, type: 'decimal', default: 0 })
  balance?: number;

  @Column({
    name: 'currency',
    nullable: false,
    type: 'enum',
    enum: Currency,
    default: Currency.NGN,
  })
  currency?: Currency;

  @CreateDateColumn({
    name: 'created_at',
    type: 'timestamp',
    nullable: false,
    default: () => 'CURRENT_TIMESTAMP',
  })
  created_at: Date;

  @UpdateDateColumn({
    name: 'updated_at',
    type: 'timestamp',
    nullable: true,
  })
  updated_at: Date;

  @DeleteDateColumn({
    name: 'deleted_at',
    type: 'timestamp',
    nullable: true,
  })
  deleted_at: Date;

  @ManyToOne(() => User, (user) => user.wallets)
  @JoinColumn({ name: 'user_id' })
  user: User;
}
