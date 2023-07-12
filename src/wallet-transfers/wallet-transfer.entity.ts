import {
  Entity,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  PrimaryGeneratedColumn,
  BaseEntity,
} from 'typeorm';

@Entity()
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

  // default - 'NGN'
  // enum - 'NGN', 'GHS', 'USD'
  @Column({ name: 'currency', nullable: true, type: 'varchar', length: 3 })
  currency?: string;

  @Column({ name: 'reason', nullable: true, type: 'text' })
  reason?: string;

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
