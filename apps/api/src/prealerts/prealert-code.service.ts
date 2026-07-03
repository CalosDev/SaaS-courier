import { randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const PREFIX = 'PA';
const RANDOM_PART_LENGTH = 10;

@Injectable()
export class PrealertCodeService {
  generate(): string {
    const bytes = randomBytes(RANDOM_PART_LENGTH);
    let suffix = '';

    for (const value of bytes) {
      suffix += ALPHABET[value % ALPHABET.length];
    }

    return `${PREFIX}${suffix}`;
  }
}
