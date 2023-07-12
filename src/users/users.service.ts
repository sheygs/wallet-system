import { Injectable } from '@nestjs/common';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from './user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private userRepository: Repository<User>,
  ) {}
  async create(email: string, password: string) {
    const user = await this.userRepository.create({ email, password });

    // console.log({ user });

    return this.userRepository.save(user);
  }
}
