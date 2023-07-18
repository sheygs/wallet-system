import {
  Entity,
  Column,
  CreateDateColumn,
  PrimaryGeneratedColumn,
  BaseEntity,
} from 'typeorm';

export enum TransactionType {
  DEPOSIT = 'DEPOSIT',
  TRANSFER = 'TRANSFER',
}

export enum TransactionStatus {
  PENDING = 'pending',
  SUCCESSFUL = 'successful',
  FAILED = 'failed',
}

@Entity({ name: 'wallet_transactions' })
export class WalletTransaction extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  user_id?: string;

  @Column({ name: 'source_wallet_id', type: 'uuid' })
  source_wallet_id: string;

  @Column({ name: 'amount', type: 'decimal', nullable: false })
  amount: number;

  @Column({
    name: 'transaction_type',
    type: 'enum',
    nullable: false,
    enum: TransactionType,
  })
  transaction_type: TransactionType;

  @Column({
    name: 'transaction_status',
    type: 'enum',
    enum: TransactionStatus,
    default: TransactionStatus.PENDING,
  })
  transaction_status: TransactionStatus;

  @CreateDateColumn({
    name: 'created_at',
    type: 'timestamp',
    nullable: false,
    default: () => 'CURRENT_TIMESTAMP',
  })
  created_at: Date;
}
