import { PrealertCodeService } from './prealert-code.service';

describe('PrealertCodeService', () => {
  const service = new PrealertCodeService();

  it('generates codes with the PA prefix and 10 non-ambiguous characters', () => {
    const code = service.generate();

    expect(code).toMatch(/^PA[A-HJ-NP-Z2-9]{10}$/);
  });

  it('never uses ambiguous characters', () => {
    const codes = Array.from({ length: 250 }, () => service.generate());

    expect(codes.every((code) => !/[IO01]/.test(code))).toBe(true);
  });
});
