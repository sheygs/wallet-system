import { BadRequestException } from '@nestjs/common';
import { HashService } from './hash.service';

describe('Password hashing', () => {
  const service = new HashService();

  it('hashes and verifies a password', async () => {
    const hash = await service.hashPassword('a-secure-test-password');

    expect(hash).not.toBe('a-secure-test-password');
    expect(await service.comparePassword('a-secure-test-password', hash)).toBe(
      true,
    );
    expect(await service.comparePassword('wrong-password', hash)).toBe(false);
  });

  it('rejects UTF-8 passwords that bcrypt would silently truncate', async () => {
    await expect(service.hashPassword('😀'.repeat(19))).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('does not accept a password suffix beyond bcrypt’s byte limit', async () => {
    const password = 'a'.repeat(72);
    const hash = await service.hashPassword(password);

    expect(await service.comparePassword(password + 'suffix', hash)).toBe(
      false,
    );
  });
});
