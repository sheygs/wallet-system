import {
  Entity,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  PrimaryGeneratedColumn,
  BaseEntity,
} from 'typeorm';
import { Currency } from '../wallets/wallet.entity';

@Entity({ name: 'wallet_transfers' })
export class WalletTransfer extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'source_wallet_id', type: 'uuid' })
  source_wallet_id: string;

  @Column({ name: 'destination_wallet_id', type: 'uuid' })
  destination_wallet_id: string;

  // amount to transfer
  @Column({ name: 'amount', type: 'varchar' })
  amount: string;

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
    name: 'approved',
    type: 'boolean',
    nullable: true,
    default: false,
  })
  approved?: boolean;

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
