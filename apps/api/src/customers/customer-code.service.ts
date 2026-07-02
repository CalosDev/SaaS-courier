import { Injectable } from '@nestjs/common';
import { randomBytes } from 'node:crypto';

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

@Injectable()
export class CustomerCodeService {
  generateRandom(input: { prefix: string; randomLength: number }): string {
    const bytes = randomBytes(input.randomLength);
    let suffix = '';

    for (let index = 0; index < input.randomLength; index += 1) {
      suffix += ALPHABET.charAt(bytes[index] % ALPHABET.length);
    }

    return `${input.prefix}${suffix}`;
  }

  formatSequential(input: {
    prefix: string;
    sequence: number | bigint;
    padding: number;
  }): string {
    const sequence = input.sequence.toString().padStart(input.padding, '0');

    return `${input.prefix}${sequence}`;
  }
}
