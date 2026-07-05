import {
  ExternalTrackingNormalizationError,
  ExternalTrackingNormalizer,
} from './external-tracking-normalizer';

describe('ExternalTrackingNormalizer', () => {
  const normalizer = new ExternalTrackingNormalizer();

  it('normalizes separators, whitespace and casing while preserving the trimmed original value', () => {
    expect(normalizer.normalize(' 1z-999.aa1/01 2345 6784 ')).toEqual({
      original: '1z-999.aa1/01 2345 6784',
      normalized: '1Z999AA10123456784',
    });
  });

  it('rejects missing tracking values', () => {
    expect(() => normalizer.normalize('   ')).toThrow(
      new ExternalTrackingNormalizationError('required'),
    );
  });

  it('rejects normalized values outside the supported length range', () => {
    expect(() => normalizer.normalize('a-1')).toThrow(
      new ExternalTrackingNormalizationError('invalid'),
    );
    expect(() => normalizer.normalize('A'.repeat(101))).toThrow(
      new ExternalTrackingNormalizationError('invalid'),
    );
  });
});
