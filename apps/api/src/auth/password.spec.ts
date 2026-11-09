import { hashPassword, verifyPassword } from './password.js';

describe('password helpers', () => {
  it('vérifie le mot de passe sans le stocker en clair', async () => {
    const password = 'mot-de-passe-solide';
    const hash = await hashPassword(password);

    expect(hash).not.toContain(password);
    await expect(verifyPassword(password, hash)).resolves.toBe(true);
    await expect(verifyPassword('mot-de-passe-incorrect', hash)).resolves.toBe(false);
  });

  it('refuse un format de hash invalide', async () => {
    await expect(verifyPassword('mot-de-passe-solide', 'hash-invalide')).resolves.toBe(false);
  });
});
