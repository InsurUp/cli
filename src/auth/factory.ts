import {
  createInsurUpAuth,
  DefaultInsurUpClient,
  type InsurUpAuth,
  type InsurUpScope,
  type TokenProvider,
} from '@insurup/sdk';
import { BROWSER_CLIENT_ID, type ResolvedConfig } from '../config/config.ts';
import { VERSION } from '../version.ts';
import { keychainTokenStorage } from './keychain-storage.ts';
import { m2mScopes } from './m2m.ts';

/**
 * Build the SDK auth handle for a profile, backed by keychain token storage.
 * The client secret is supplied per-login (M2M) rather than baked in, so this
 * works for both public (PKCE) and confidential (M2M) clients.
 */
export function createAuth(config: ResolvedConfig): InsurUpAuth {
  // Permit non-HTTPS only when an endpoint is explicitly http:// (local dev /
  // integration tests). Note the SDK's OIDC discovery always requires HTTPS, so
  // http servers must also supply explicit token/authorization endpoints.
  const insecure = [config.authServer, config.tokenEndpoint, config.authorizationEndpoint].some(
    (url) => url?.startsWith('http://'),
  );
  return createInsurUpAuth({
    // Fall back to the public browser client when no confidential (M2M) client
    // id is configured, so token refresh for a browser session always works.
    clientId: config.clientId || BROWSER_CLIENT_ID,
    authServer: config.authServer,
    scopes: config.scopes as readonly InsurUpScope[],
    storage: keychainTokenStorage(config.profile),
    ...(config.tokenEndpoint ? { tokenEndpoint: config.tokenEndpoint } : {}),
    ...(config.authorizationEndpoint
      ? { authorizationEndpoint: config.authorizationEndpoint }
      : {}),
    ...(insecure ? { allowInsecureRequests: true } : {}),
  });
}

/**
 * A token provider that auto-refreshes via the auth handle and, when no token is
 * available but an M2M secret is known, transparently performs a client-credentials
 * login — so M2M works statelessly in CI and `auth token` always yields a token.
 */
export function buildTokenProvider(
  config: ResolvedConfig,
  auth: InsurUpAuth,
  clientSecret?: string,
): TokenProvider {
  return async (): Promise<string | null> => {
    const token = await auth.getAccessToken();
    if (token) return token;
    if (clientSecret) {
      const result = await auth.loginWithClientCredentials({
        clientSecret,
        scopes: m2mScopes(config.scopes as readonly InsurUpScope[]),
      });
      if (result.isSuccess) return result.data.accessToken;
    }
    return null;
  };
}

/** Build the API client from a (shared) token provider. */
export function createClient(
  config: ResolvedConfig,
  tokenProvider: TokenProvider,
): DefaultInsurUpClient {
  return new DefaultInsurUpClient({
    tokenProvider,
    userAgent: `@insurup/cli/${VERSION}`,
    ...(config.apiBaseUrl ? { baseUrl: config.apiBaseUrl } : {}),
    ...(config.timeoutMs ? { timeoutMs: config.timeoutMs } : {}),
  });
}
