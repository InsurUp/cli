import type { OAuthTokens, TokenStorage } from '@insurup/sdk';
import { secrets } from 'bun';

/** Keychain service namespace for all CLI secrets. */
const SERVICE = 'com.insurup.cli';

const tokensKey = (profile: string) => `tokens:${profile}`;
const secretKey = (profile: string) => `m2m:${profile}`;

/** Minimal secret-store contract (matches `Bun.secrets`). Swappable for tests. */
export interface SecretsBackend {
  get(options: { service: string; name: string }): Promise<string | null>;
  set(options: { service: string; name: string; value: string }): Promise<void>;
  delete(options: { service: string; name: string }): Promise<boolean | undefined>;
}

let backend: SecretsBackend = secrets;

/** Override the secrets backend (used by tests to avoid the real OS keychain). */
export function setSecretsBackend(next: SecretsBackend): void {
  backend = next;
}

/**
 * An SDK {@link TokenStorage} backed by the OS keychain (`Bun.secrets`), scoped
 * to a single profile. Handed to `createInsurUpAuth({ storage })` so token reads,
 * writes, and refreshes persist securely between invocations.
 */
export function keychainTokenStorage(profile: string): TokenStorage {
  const name = tokensKey(profile);
  return {
    async get(): Promise<OAuthTokens | null> {
      const json = await backend.get({ service: SERVICE, name });
      return json ? (JSON.parse(json) as OAuthTokens) : null;
    },
    async set(tokens: OAuthTokens): Promise<void> {
      await backend.set({ service: SERVICE, name, value: JSON.stringify(tokens) });
    },
    async clear(): Promise<void> {
      await backend.delete({ service: SERVICE, name });
    },
  };
}

/** Read the stored tokens for a profile without going through the SDK. */
export async function readTokens(profile: string): Promise<OAuthTokens | null> {
  const json = await backend.get({ service: SERVICE, name: tokensKey(profile) });
  return json ? (JSON.parse(json) as OAuthTokens) : null;
}

/** Remove stored tokens for a profile. */
export async function clearTokens(profile: string): Promise<void> {
  await backend.delete({ service: SERVICE, name: tokensKey(profile) });
}

/** Read the stored M2M client secret for a profile, if any. */
export async function getClientSecret(profile: string): Promise<string | null> {
  return backend.get({ service: SERVICE, name: secretKey(profile) });
}

/** Persist the M2M client secret for a profile in the OS keychain. */
export async function setClientSecret(profile: string, value: string): Promise<void> {
  await backend.set({ service: SERVICE, name: secretKey(profile), value });
}

/** Remove the stored M2M client secret for a profile. */
export async function clearClientSecret(profile: string): Promise<void> {
  await backend.delete({ service: SERVICE, name: secretKey(profile) });
}
