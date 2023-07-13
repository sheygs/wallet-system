import {
  Entity,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  PrimaryGeneratedColumn,
  BaseEntity,
} from 'typeorm';

export enum Currency {
  NGN = 'NGN',
  USD = 'USD',
  GHS = 'GHS',
}

@Entity({ name: 'wallets' })
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

  @Column({
    name: 'currency',
    nullable: true,
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
}
