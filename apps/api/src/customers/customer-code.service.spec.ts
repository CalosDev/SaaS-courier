import { CustomerCodeService } from './customer-code.service';

describe('CustomerCodeService', () => {
  const service = new CustomerCodeService();

  it('generates the default customerCode format', () => {
    const code = service.generate();

    expect(code).toMatch(/^C[A-HJ-NP-Z2-9]{8}$/);
  });

  it('does not generate ambiguous characters', () => {
    const code = service.generate();

    expect(code).not.toMatch(/[IO10]/);
  });

  it('generates different codes', () => {
    const first = service.generate();
    const second = service.generate();

    expect(first).not.toBe(second);
  });

  it('does not define the storage format as exclusively random', () => {
    expect('CF-10542').toMatch(/^[A-Z0-9][A-Z0-9_-]{2,39}$/);
    expect('10004582').toMatch(/^[A-Z0-9][A-Z0-9_-]{2,39}$/);
    expect('MIA-CF-292').toMatch(/^[A-Z0-9][A-Z0-9_-]{2,39}$/);
  });
});
