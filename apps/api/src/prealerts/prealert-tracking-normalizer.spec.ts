import { InvalidPrealertInputError } from './prealert.errors';
import { PrealertTrackingNormalizer } from './prealert-tracking-normalizer';

describe('PrealertTrackingNormalizer', () => {
  const normalizer = new PrealertTrackingNormalizer();

  it('normalizes external tracking by trimming, uppercasing and removing separators', () => {
    expect(normalizer.normalize(' 1Z-999-AA1-01/2345.6784 ')).toEqual({
      original: '1Z-999-AA1-01/2345.6784',
      normalized: '1Z999AA10123456784',
    });
  });

  it('rejects a tracking value without alphanumeric content', () => {
    expect(() => normalizer.normalize(' - / . ')).toThrow(
      InvalidPrealertInputError,
    );
  });

  it('rejects normalized values shorter than three characters', () => {
    expect(() => normalizer.normalize(' A- ')).toThrow(
      InvalidPrealertInputError,
    );
  });
});
