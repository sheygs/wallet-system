import { Wallet } from '../wallets/wallet.entity';
import { User } from '../users/user.entity';
import {
  Entity,
  Column,
  CreateDateColumn,
  PrimaryGeneratedColumn,
  BaseEntity,
  Check,
  Index,
  ManyToOne,
  JoinColumn,
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

export const SUCCESSFUL_DEPOSIT_UNIQUE_INDEX =
  'wallet_transactions_successful_deposit_reference_unique';

@Entity({ name: 'wallet_transactions' })
@Index(SUCCESSFUL_DEPOSIT_UNIQUE_INDEX, ['reference'], {
  unique: true,
  where:
    '"transaction_type" = \'DEPOSIT\' AND "transaction_status" = \'successful\'',
})
@Check(
  'wallet_transactions_amount_valid',
  '("amount" > 0 AND "amount" <= 9007199254740991 AND "amount" = trunc("amount")) IS TRUE',
)
@Check(
  'wallet_transactions_deposit_reference_required',
  `"transaction_type" <> 'DEPOSIT' OR "transaction_status" <> 'successful' OR ("reference" IS NOT NULL AND "reference" ~ '[^[:space:]]')`,
)
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
    name: 'reference',
    type: 'varchar',
    nullable: true,
  })
  reference: string;

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

  @ManyToOne(() => Wallet, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'source_wallet_id',
    foreignKeyConstraintName: 'wallet_transactions_wallet_fk',
  })
  wallet?: Wallet;

  @ManyToOne(() => User, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'user_id',
    foreignKeyConstraintName: 'wallet_transactions_user_fk',
  })
  user?: User;

  @CreateDateColumn({
    name: 'created_at',
    type: 'timestamp',
    nullable: false,
    default: () => 'CURRENT_TIMESTAMP',
  })
  created_at: Date;
}
