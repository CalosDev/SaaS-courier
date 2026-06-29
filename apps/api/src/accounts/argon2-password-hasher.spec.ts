import { Argon2PasswordHasher } from './argon2-password-hasher';

describe('Argon2PasswordHasher', () => {
  const passwordHasher = new Argon2PasswordHasher();

  it('generates Argon2id hashes', async () => {
    const hash = await passwordHasher.hash('Correct Horse Battery Staple');

    expect(hash.startsWith('$argon2id$')).toBe(true);
  });

  it('verifies a correct password', async () => {
    const password = 'Correct Horse Battery Staple';
    const hash = await passwordHasher.hash(password);

    await expect(passwordHasher.verify(password, hash)).resolves.toBe(true);
  });

  it('rejects an incorrect password', async () => {
    const hash = await passwordHasher.hash('Correct Horse Battery Staple');

    await expect(passwordHasher.verify('Tr0ub4dor&3', hash)).resolves.toBe(
      false,
    );
  });

  it('produces different hashes for the same password', async () => {
    const password = 'Correct Horse Battery Staple';

    const firstHash = await passwordHasher.hash(password);
    const secondHash = await passwordHasher.hash(password);

    expect(firstHash).not.toBe(secondHash);
  });
});
