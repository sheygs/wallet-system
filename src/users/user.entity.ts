import {
  Entity,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  PrimaryGeneratedColumn,
  BaseEntity,
} from 'typeorm';

@Entity({ name: 'users' })
export class User extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    name: 'first_name',
    nullable: false,
    type: 'varchar',
    length: 50,
  })
  first_name: string;

  @Column({
    name: 'last_name',
    nullable: false,
    type: 'varchar',
    length: 50,
  })
  last_name: string;

  @Column({
    name: 'email',
    nullable: true,
    type: 'varchar',
  })
  email: string;

  @Column({
    name: 'password',
    nullable: false,
    type: 'varchar',
  })
  password: string;

  @Column({
    name: 'phone_number',
    nullable: true,
    type: 'varchar',
    length: 20,
  })
  phone_number: string;

  @Column({
    name: 'is_admin',
    type: 'boolean',
    nullable: true,
    default: false,
  })
  is_admin?: boolean;

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
