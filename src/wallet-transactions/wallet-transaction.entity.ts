import {
  Entity,
  Column,
  CreateDateColumn,
  PrimaryGeneratedColumn,
  BaseEntity,
} from 'typeorm';

@Entity()
export class WalletTransaction extends BaseEntity {
  //transaction_id
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  user_id: string;

  // setup one to many relationship
  // a wallet can create multiple wallet transactions
  // a wallet transactions belongs to one wallet
  @Column({ name: 'wallet_id', type: 'uuid', nullable: true })
  wallet_id?: string;

  @Column({ name: 'amount', type: 'varchar' })
  amount: string;

  // enum - 'deposit', 'withdrawal'
  @Column({ name: 'transaction_type', type: 'varchar', length: 15 })
  transaction_type: string;

  // default - 'pending'
  // enum - 'pending', 'successful', 'failed'
  @Column({ name: 'transaction_status', type: 'varchar', length: 15 })
  transaction_status: string;

  @CreateDateColumn({
    name: 'created_at',
    type: 'timestamp',
    nullable: false,
    default: () => 'CURRENT_TIMESTAMP',
  })
  created_at: Date;
}
