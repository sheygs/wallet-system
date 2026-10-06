import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  Unique,
  Check,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../users/user.entity';
import { Transfer } from './transfer.entity';

@Entity({ name: 'transfer_requests' })
@Unique('transfer_requests_transfer_id_unique', ['transfer_id'])
@Check(
  'transfer_requests_key_valid',
  `"idempotency_key" ~ '^[A-Za-z0-9._:-]{1,128}$'`,
)
@Check('transfer_requests_hash_valid', `"request_hash" ~ '^[0-9a-f]{64}$'`)
@Check(
  'transfer_requests_response_valid',
  `(jsonb_typeof("response") = 'object' AND ("response"->>'id')::uuid = "transfer_id" AND "response"->>'requested_by' = "user_id"::text) IS TRUE`,
)
export class TransferRequest {
  @PrimaryColumn({
    type: 'uuid',
    primaryKeyConstraintName: 'transfer_requests_pkey',
  })
  user_id: string;

  @PrimaryColumn({
    type: 'varchar',
    length: 128,
    primaryKeyConstraintName: 'transfer_requests_pkey',
  })
  idempotency_key: string;

  @Column({ type: 'char', length: 64 })
  request_hash: string;

  @Column({ type: 'uuid' })
  transfer_id: string;

  @Column({ type: 'jsonb' })
  response: Record<string, unknown>;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @ManyToOne(() => User, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'user_id',
    foreignKeyConstraintName: 'transfer_requests_user_fk',
  })
  user?: User;

  @ManyToOne(() => Transfer, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'transfer_id',
    foreignKeyConstraintName: 'transfer_requests_transfer_fk',
  })
  transfer?: Transfer;
}
