import { beforeEach, describe, expect, test } from 'bun:test';
import type { OAuthTokens } from '@insurup/sdk';
import {
  clearClientSecret,
  clearTokens,
  getClientSecret,
  keychainTokenStorage,
  readTokens,
  setClientSecret,
  setSecretsBackend,
} from '../../src/auth/keychain-storage.ts';
import { memorySecrets } from '../helpers/memory-secrets.ts';

const tokens: OAuthTokens = {
  accessToken: 'a',
  tokenType: 'bearer',
  refreshToken: 'r',
  expiresAt: 123,
};

beforeEach(() => {
  setSecretsBackend(memorySecrets());
});

describe('keychainTokenStorage (SDK TokenStorage adapter)', () => {
  test('set / get / clear round-trip, scoped per profile', async () => {
    const storage = keychainTokenStorage('default');
    expect(await storage.get()).toBeNull();
    await storage.set(tokens);
    expect(await storage.get()).toEqual(tokens);
    // a different profile is isolated
    expect(await keychainTokenStorage('other').get()).toBeNull();
    await storage.clear();
    expect(await storage.get()).toBeNull();
  });
});

describe('token + secret helpers', () => {
  test('readTokens / clearTokens', async () => {
    await keychainTokenStorage('p').set(tokens);
    expect(await readTokens('p')).toEqual(tokens);
    await clearTokens('p');
    expect(await readTokens('p')).toBeNull();
  });

  test('client secret set / get / clear', async () => {
    expect(await getClientSecret('p')).toBeNull();
    await setClientSecret('p', 'shh');
    expect(await getClientSecret('p')).toBe('shh');
    await clearClientSecret('p');
    expect(await getClientSecret('p')).toBeNull();
  });
});
