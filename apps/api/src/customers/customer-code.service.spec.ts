import { CustomerCodeService } from './customer-code.service';

describe('CustomerCodeService', () => {
  const service = new CustomerCodeService();

  it('generates the default random customerCode format', () => {
    const code = service.generateRandom({
      prefix: 'C',
      randomLength: 8,
    });

    expect(code).toMatch(/^C[A-HJ-NP-Z2-9]{8}$/);
  });

  it('does not generate ambiguous characters', () => {
    const code = service.generateRandom({
      prefix: 'C',
      randomLength: 8,
    });

    expect(code).not.toMatch(/[IO10]/);
  });

  it('generates different codes', () => {
    const first = service.generateRandom({
      prefix: 'CF-',
      randomLength: 6,
    });
    const second = service.generateRandom({
      prefix: 'CF-',
      randomLength: 6,
    });

    expect(first).not.toBe(second);
  });

  it('formats sequential customer codes with left padding', () => {
    expect(
      service.formatSequential({
        prefix: 'CF-',
        sequence: 42,
        padding: 6,
      }),
    ).toBe('CF-000042');
  });

  it('does not define the storage format as exclusively random', () => {
    expect('CF-10542').toMatch(/^[A-Z0-9][A-Z0-9_-]{2,39}$/);
    expect('10004582').toMatch(/^[A-Z0-9][A-Z0-9_-]{2,39}$/);
    expect('MIA-CF-292').toMatch(/^[A-Z0-9][A-Z0-9_-]{2,39}$/);
  });
});
