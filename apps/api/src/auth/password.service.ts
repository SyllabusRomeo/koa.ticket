import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as argon2 from 'argon2';

@Injectable()
export class PasswordService {
  private readonly minLength: number;

  constructor(config: ConfigService) {
    this.minLength = Number(config.get('PASSWORD_MIN_LENGTH') ?? 12);
  }

  async hash(plain: string): Promise<string> {
    return argon2.hash(plain, { type: argon2.argon2id });
  }

  async verify(hash: string, plain: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, plain);
    } catch {
      return false;
    }
  }

  validatePolicy(plain: string): string | null {
    if (plain.length < this.minLength) {
      return `Password must be at least ${this.minLength} characters`;
    }
    if (!/[a-z]/.test(plain) || !/[A-Z]/.test(plain) || !/\d/.test(plain)) {
      return 'Password must include uppercase, lowercase, and a number';
    }
    return null;
  }
}
