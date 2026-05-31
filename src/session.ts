import type { DefaultInsurUpClient, InsurUpAuth, TokenProvider } from '@insurup/sdk';
import { buildTokenProvider, createAuth, createClient } from './auth/factory.ts';
import { getClientSecret } from './auth/keychain-storage.ts';
import {
  BROWSER_CLIENT_ID,
  type ResolvedConfig,
  readConfigFile,
  resolveConfig,
} from './config/config.ts';
import type { LocalContext } from './context.ts';
import type { GlobalFlags } from './shared/flags.ts';

/** Everything a command needs to talk to InsurUp for a single invocation. */
export interface Session {
  readonly config: ResolvedConfig;
  readonly auth: InsurUpAuth;
  readonly client: DefaultInsurUpClient;
  /** Returns a valid access token (auto-refresh + M2M auto-login), or null. */
  readonly getAccessToken: TokenProvider;
}

/** Resolve effective config from flags + env + config file. */
export async function loadConfig(ctx: LocalContext, flags: GlobalFlags): Promise<ResolvedConfig> {
  const file = await readConfigFile(ctx.env);
  return resolveConfig({ flags, env: ctx.env, file });
}

/**
 * Build the auth handle, token provider, and API client for this invocation.
 * The M2M secret is read from env (resolved config) or the keychain so
 * client-credentials login can happen transparently.
 */
export async function createSession(ctx: LocalContext, flags: GlobalFlags): Promise<Session> {
  const config = await loadConfig(ctx, flags);
  const clientSecret = config.clientSecret ?? (await getClientSecret(config.profile)) ?? undefined;
  // A configured client secret means M2M: refresh/login uses the confidential
  // client id. Otherwise this is a browser session whose tokens were minted for
  // the public `cli` client, so refreshes must use that same client id.
  const clientId = clientSecret ? config.clientId : BROWSER_CLIENT_ID;
  const auth = createAuth({ ...config, clientId });
  const getAccessToken = buildTokenProvider(config, auth, clientSecret);
  const client = createClient(config, getAccessToken);
  return { config, auth, client, getAccessToken };
}
