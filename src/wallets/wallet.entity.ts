import {
  Entity,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  PrimaryGeneratedColumn,
  BaseEntity,
} from 'typeorm';

@Entity()
export class Wallet extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // setup one to many relationship
  // a user can create multiple wallets
  // a wallet belongs to one user
  @Column({ name: 'user_id', type: 'uuid' })
  user_id: string;

  @Column({ name: 'balance', nullable: true, type: 'varchar' })
  balance?: string;

  // default - 'NGN'
  // enum - 'NGN', 'GHS', 'USD'
  @Column({ name: 'currency', nullable: true, type: 'varchar', length: 3 })
  currency?: string;

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
}
