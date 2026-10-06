import { User } from '../users/user.entity';
import {
  Entity,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  PrimaryGeneratedColumn,
  BaseEntity,
  Check,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Currency, Wallet } from '../wallets/wallet.entity';
import { TransferStatus } from '../interface/types';

@Entity({ name: 'transfers' })
@Check(
  'transfers_amount_valid',
  '("transferred_amount" > 0 AND "transferred_amount" <= 9007199254740991 AND "transferred_amount" = trunc("transferred_amount")) IS TRUE',
)
@Check(
  'transfers_wallets_distinct',
  '("source_wallet_id" <> "destination_wallet_id") IS TRUE',
)
export class Transfer extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'source_wallet_id', type: 'uuid' })
  source_wallet_id: string;

  @Column({ name: 'destination_wallet_id', type: 'uuid' })
  destination_wallet_id: string;

  @Column({ name: 'transferred_amount', type: 'decimal', nullable: false })
  transferred_amount: number;

  @Column({
    name: 'currency',
    nullable: true,
    type: 'enum',
    enum: Currency,
    default: Currency.NGN,
  })
  currency?: Currency;

  @Column({ name: 'reason', nullable: true, type: 'text' })
  reason?: string;

  @Column({
    name: 'status',
    nullable: false,
    type: 'enum',
    enum: TransferStatus,
    default: TransferStatus.PENDING,
  })
  status: TransferStatus;

  @Column({
    name: 'approved',
    type: 'boolean',
    nullable: true,
    default: false,
  })
  approved?: boolean;

  @Column({ type: 'boolean', default: false })
  requires_approval: boolean;

  @Column({ type: 'uuid', nullable: true })
  requested_by: string;

  @Column({ type: 'uuid', nullable: true })
  reviewed_by: string;

  @Column({ type: 'timestamp', nullable: true })
  reviewed_at: Date;

  @ManyToOne(() => Wallet, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'source_wallet_id',
    foreignKeyConstraintName: 'transfers_source_wallet_fk',
  })
  source_wallet?: Wallet;

  @ManyToOne(() => Wallet, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'destination_wallet_id',
    foreignKeyConstraintName: 'transfers_destination_wallet_fk',
  })
  destination_wallet?: Wallet;

  @ManyToOne(() => User, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'requested_by',
    foreignKeyConstraintName: 'transfers_requester_fk',
  })
  requester?: User;

  @ManyToOne(() => User, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'reviewed_by',
    foreignKeyConstraintName: 'transfers_reviewer_fk',
  })
  reviewer?: User;

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
}
