import { Injectable } from '@nestjs/common';

import { InvalidPrealertInputError } from './prealert.errors';

@Injectable()
export class PrealertTrackingNormalizer {
  normalize(value: string): { original: string; normalized: string } {
    if (typeof value !== 'string') {
      throw new InvalidPrealertInputError(
        'Invalid prealert input: externalTrackingNumber is required',
      );
    }

    const original = value.trim();

    if (!original) {
      throw new InvalidPrealertInputError(
        'Invalid prealert input: externalTrackingNumber is required',
      );
    }

    const normalized = original
      .toUpperCase()
      .replace(/[\s\-./]+/g, '')
      .replace(/[^A-Z0-9]/g, '');

    if (normalized.length < 3 || normalized.length > 100) {
      throw new InvalidPrealertInputError(
        'Invalid prealert input: externalTrackingNumber is invalid',
      );
    }

    return {
      original,
      normalized,
    };
  }
}
