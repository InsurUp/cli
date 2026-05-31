import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { DEFAULT_AUTH_SERVER } from '@insurup/sdk';
import type { GlobalFlags } from '../shared/flags.ts';
import { configFilePath } from './paths.ts';

type Env = Readonly<Partial<Record<string, string>>>;

/** Default scopes requested when none are configured (mirrors the SDK demo). */
export const DEFAULT_SCOPES = ['openid', 'profile', 'offline_access', 'core-api'] as const;

/**
 * The public, native OAuth client used for the interactive browser (authorization
 * code + PKCE) flow. Hardcoded — it is a public client that carries no secret, so
 * it is safe to ship. `--client-id` / `INSURUP_CLIENT_ID` are reserved for the
 * confidential M2M client and are ignored by browser login.
 */
export const BROWSER_CLIENT_ID = 'cli';

/** Per-profile, non-secret settings persisted to the config file. */
export interface ProfileConfig {
  clientId?: string;
  authServer?: string;
  apiBaseUrl?: string;
  scopes?: string[];
}

/** Shape of `~/.config/insurup/config.json`. */
export interface ConfigFile {
  defaultProfile?: string;
  profiles?: Record<string, ProfileConfig>;
}

/** Fully-resolved effective configuration for a single invocation. */
export interface ResolvedConfig {
  readonly profile: string;
  readonly clientId?: string;
  readonly clientSecret?: string;
  readonly authServer: string;
  /** Explicit token endpoint; when set the SDK skips OIDC discovery. */
  readonly tokenEndpoint?: string;
  /** Explicit authorization endpoint; when set the SDK skips OIDC discovery. */
  readonly authorizationEndpoint?: string;
  readonly apiBaseUrl?: string;
  readonly scopes: readonly string[];
  readonly timeoutMs?: number;
}

function parseScopes(raw: string | undefined): string[] | undefined {
  if (!raw) return undefined;
  const scopes = raw
    .split(/[,\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  return scopes.length > 0 ? scopes : undefined;
}

/** Read and parse the config file; returns `{}` when it does not exist or is invalid. */
export async function readConfigFile(env: Env = process.env): Promise<ConfigFile> {
  const file = Bun.file(configFilePath(env));
  if (!(await file.exists())) return {};
  try {
    const parsed = (await file.json()) as ConfigFile;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

/** Persist the config file with `0600` permissions, creating the directory if needed. */
export async function writeConfigFile(config: ConfigFile, env: Env = process.env): Promise<void> {
  const path = configFilePath(env);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600 });
}

/** Determine the active profile name from flags, env, file, then default. */
export function resolveProfileName(
  flags: Pick<GlobalFlags, 'profile'>,
  env: Env,
  file: ConfigFile,
): string {
  return flags.profile ?? env.INSURUP_PROFILE ?? file.defaultProfile ?? 'default';
}

/**
 * Resolve effective config with precedence: flags > env > config file > defaults.
 * `clientSecret` only ever comes from the environment here; the keychain-backed
 * secret is read separately at auth time so it never lands in plain config.
 */
export function resolveConfig(args: {
  flags: GlobalFlags;
  env?: Env;
  file?: ConfigFile;
}): ResolvedConfig {
  const env = args.env ?? process.env;
  const file = args.file ?? {};
  const profile = resolveProfileName(args.flags, env, file);
  const profileCfg = file.profiles?.[profile] ?? {};

  return {
    profile,
    clientId: args.flags.clientId ?? env.INSURUP_CLIENT_ID ?? profileCfg.clientId,
    clientSecret: env.INSURUP_CLIENT_SECRET,
    authServer:
      args.flags.authServer ??
      env.INSURUP_AUTH_SERVER ??
      profileCfg.authServer ??
      DEFAULT_AUTH_SERVER,
    tokenEndpoint: env.INSURUP_TOKEN_ENDPOINT,
    authorizationEndpoint: env.INSURUP_AUTHORIZATION_ENDPOINT,
    apiBaseUrl: args.flags.baseUrl ?? env.INSURUP_API_URL ?? profileCfg.apiBaseUrl,
    scopes: parseScopes(env.INSURUP_SCOPES) ?? profileCfg.scopes ?? [...DEFAULT_SCOPES],
    timeoutMs: args.flags.timeout ?? parseTimeout(env.INSURUP_TIMEOUT),
  };
}

function parseTimeout(raw: string | undefined): number | undefined {
  if (!raw) return undefined;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}
