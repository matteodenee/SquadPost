import { readCookie, SESSION_COOKIE_NAME } from './cookies.js';

describe('readCookie', () => {
  it('retrouve le jeton de session parmi plusieurs cookies', () => {
    expect(
      readCookie(`theme=dark; ${SESSION_COOKIE_NAME}=abc_123; locale=fr`, SESSION_COOKIE_NAME),
    ).toBe('abc_123');
  });

  it('retourne undefined lorsque le cookie est absent', () => {
    expect(readCookie('theme=dark', SESSION_COOKIE_NAME)).toBeUndefined();
  });
});
