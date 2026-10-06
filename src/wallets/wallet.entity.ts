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
  Index,
  Check,
} from 'typeorm';
import { User } from '../users/user.entity';

export enum Currency {
  NGN = 'NGN',
  USD = 'USD',
  GHS = 'GHS',
}

export enum BaseCurrency {
  NGN = 'KOBO',
  USD = 'CENTS',
  GHS = 'PESEWA',
}

export const ACTIVE_WALLET_UNIQUE_INDEX = 'wallets_active_user_currency_unique';

@Check(
  'wallets_balances_valid',
  '("kobo_balance" >= 0 AND "kobo_balance" <= 9007199254740991 AND "kobo_balance" = trunc("kobo_balance") AND "balance" >= 0 AND "balance" = "kobo_balance" / 100) IS TRUE',
)
@Entity({ name: 'wallets' })
@Index(ACTIVE_WALLET_UNIQUE_INDEX, ['user_id', 'currency'], {
  unique: true,
  where: '"deleted_at" IS NULL',
})
export class Wallet extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  user_id: string;

  @Column({ name: 'balance', nullable: false, type: 'decimal', default: 0 })
  balance?: number | string;

  @Column({
    name: 'currency',
    nullable: false,
    type: 'enum',
    enum: Currency,
    default: Currency.NGN,
  })
  currency?: Currency;

  @Column({
    name: 'kobo_balance',
    nullable: false,
    type: 'decimal',
    default: 0,
  })
  kobo_balance?: number;

  @Column({
    name: 'base_currency',
    nullable: false,
    type: 'enum',
    enum: BaseCurrency,
    default: BaseCurrency.NGN,
  })
  base_currency?: BaseCurrency;

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
