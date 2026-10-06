import { BadRequestException, Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

@Injectable()
export class HashService {
  private readonly SALT_OR_ROUNDS = 10;

  async hashPassword(password: string): Promise<string> {
    if (Buffer.byteLength(password, 'utf8') > 72) {
      throw new BadRequestException('Password exceeds 72 bytes');
    }
    return await bcrypt.hash(password, this.SALT_OR_ROUNDS);
  }

  async comparePassword(password: string, hash: string): Promise<boolean> {
    if (Buffer.byteLength(password, 'utf8') > 72) return false;
    return await bcrypt.compare(password, hash);
  }
}
