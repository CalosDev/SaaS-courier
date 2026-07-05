import { PackageCodeService } from './package-code.service';

describe('PackageCodeService', () => {
  const service = new PackageCodeService();

  it('generates codes with the PK prefix and 12 non-ambiguous characters', () => {
    const code = service.generate();

    expect(code).toMatch(/^PK[A-HJ-NP-Z2-9]{12}$/);
  });

  it('never uses ambiguous characters', () => {
    const codes = Array.from({ length: 250 }, () => service.generate());

    expect(codes.every((code) => !/[IO01]/.test(code))).toBe(true);
  });
});
