import { Injectable } from '@nestjs/common';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from './user.entity';
import { CreateUserDTO } from './dtos/user.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private userRepository: Repository<User>,
  ) {}
  async createUser(body: CreateUserDTO): Promise<User> {
    const user = this.userRepository.create(body);

    return this.userRepository.save(user);
  }

  // search for an existing user by email or phone number
  async findUser(email?: string, phoneNumber?: string): Promise<User[]> {
    const users = await this.userRepository.find({
      where: [email && { email }, phoneNumber && { phone_number: phoneNumber }],
    });

    return users;
  }

  async getUserById(user_id: string): Promise<User> {
    const user = await this.userRepository.findOne({
      where: {
        id: user_id,
      },
    });

    return user;
  }
}
