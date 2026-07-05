import { Injectable } from '@nestjs/common';

export class ExternalTrackingNormalizationError extends Error {
  constructor(readonly reason: 'required' | 'invalid') {
    super(`External tracking normalization failed: ${reason}`);
    this.name = 'ExternalTrackingNormalizationError';
  }
}

@Injectable()
export class ExternalTrackingNormalizer {
  normalize(value: unknown): { original: string; normalized: string } {
    if (typeof value !== 'string') {
      throw new ExternalTrackingNormalizationError('required');
    }

    const original = value.trim();

    if (!original) {
      throw new ExternalTrackingNormalizationError('required');
    }

    const normalized = original
      .toUpperCase()
      .replace(/[\s\-./]+/g, '')
      .replace(/[^A-Z0-9]/g, '');

    if (normalized.length < 3 || normalized.length > 100) {
      throw new ExternalTrackingNormalizationError('invalid');
    }

    return {
      original,
      normalized,
    };
  }
}
