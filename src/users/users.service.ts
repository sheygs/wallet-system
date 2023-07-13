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
  async createUser(body: CreateUserDTO) {
    const user = this.userRepository.create(body);

    return this.userRepository.save(user);
  }

  // search for an existing user by email or phone number
  async findUser(email?: string, phoneNumber?: string) {
    const users = await this.userRepository.find({
      where: [email && { email }, phoneNumber && { phone_number: phoneNumber }],
    });

    return users;
  }

  // create a method to find a user by email or phone number
  //   async findOneUser(email?: string, phoneNumber?: string) {
  //     const user = await this.userRepository.findOne({
  //       where: {
  //         ...(email && { email }),
  //         ...(phoneNumber && { phone_number: phoneNumber }),
  //       },
  //     });

  //     return user;
  //   }
}
