import { Injectable } from '@nestjs/common';
import { randomBytes } from 'node:crypto';

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const DEFAULT_CODE_PREFIX = 'C';
const DEFAULT_CODE_LENGTH = 8;

@Injectable()
export class CustomerCodeService {
  generate(): string {
    const bytes = randomBytes(DEFAULT_CODE_LENGTH);
    let suffix = '';

    for (let index = 0; index < DEFAULT_CODE_LENGTH; index += 1) {
      suffix += ALPHABET.charAt(bytes[index] % ALPHABET.length);
    }

    return `${DEFAULT_CODE_PREFIX}${suffix}`;
  }
}
