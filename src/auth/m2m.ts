import type { InsurUpAuth, InsurUpScope, OAuthTokens } from '@insurup/sdk';
import { CliError } from '../shared/errors.ts';
import { EXIT } from '../shared/exit-codes.ts';

export interface M2MLoginOptions {
  readonly clientSecret: string;
  readonly scopes?: readonly InsurUpScope[];
}

/** OIDC/interactive-only scopes that a client-credentials (M2M) client must not request. */
const OIDC_ONLY_SCOPES = new Set(['openid', 'profile', 'email', 'roles', 'offline_access']);

/** Drop OIDC-only scopes, which are invalid for the client-credentials grant. */
export function m2mScopes(scopes: readonly InsurUpScope[]): readonly InsurUpScope[] {
  return scopes.filter((s) => !OIDC_ONLY_SCOPES.has(s));
}

/**
 * Perform the client-credentials (machine-to-machine) grant and return the
 * acquired tokens. The SDK persists them via the auth handle's storage.
 */
export async function m2mLogin(auth: InsurUpAuth, options: M2MLoginOptions): Promise<OAuthTokens> {
  const result = await auth.loginWithClientCredentials({
    clientSecret: options.clientSecret,
    ...(options.scopes ? { scopes: options.scopes } : {}),
  });
  if (!result.isSuccess) {
    throw new CliError(result.error.message, EXIT.AUTH);
  }
  return result.data;
}
