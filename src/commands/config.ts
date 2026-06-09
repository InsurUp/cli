import {
  buildCommand,
  buildRouteMap,
  type Command,
  type TypedCommandParameters,
} from '@stricli/core';
import type { ConfigFile, ProfileConfig, ResolvedConfig } from '../config/config.ts';
import {
  readConfigFile,
  resolveConfig,
  resolveProfileName,
  writeConfigFile,
} from '../config/config.ts';
import type { LocalContext } from '../context.ts';
import { printData, printSuccess, runCommand } from '../output/print.ts';
import { CliError } from '../shared/errors.ts';
import { EXIT } from '../shared/exit-codes.ts';
import { type GlobalFlags, globalFlags } from '../shared/flags.ts';

type ConfigKey = 'auth-server' | 'base-url' | 'browser-client-id';
type ValueSource = 'flag' | 'environment' | 'config' | 'default' | 'unset';

interface ConfigEntry {
  readonly key: ConfigKey;
  readonly outputKey: 'authServer' | 'baseUrl' | 'browserClientId';
  readonly envName: 'INSURUP_AUTH_SERVER' | 'INSURUP_API_URL' | 'INSURUP_BROWSER_CLIENT_ID';
  readonly profileKey: 'apiBaseUrl' | 'authServer' | 'browserClientId';
  value(config: ResolvedConfig): string | undefined;
  source(args: SourceArgs): ValueSource;
  normalize(value: string): string;
}

interface SourceArgs {
  readonly flags: GlobalFlags;
  readonly env: Readonly<Partial<Record<string, string>>>;
  readonly profileConfig: ProfileConfig;
}

const CONFIG_ENTRIES: Record<ConfigKey, ConfigEntry> = {
  'auth-server': {
    key: 'auth-server',
    outputKey: 'authServer',
    envName: 'INSURUP_AUTH_SERVER',
    profileKey: 'authServer',
    value: (config) => config.authServer,
    source: ({ flags, env, profileConfig }) => {
      if (flags.authServer !== undefined) return 'flag';
      if (env.INSURUP_AUTH_SERVER !== undefined) return 'environment';
      if (profileConfig.authServer !== undefined) return 'config';
      return 'default';
    },
    normalize: normalizeUrlFor('auth-server'),
  },
  'base-url': {
    key: 'base-url',
    outputKey: 'baseUrl',
    envName: 'INSURUP_API_URL',
    profileKey: 'apiBaseUrl',
    value: (config) => config.apiBaseUrl,
    source: ({ flags, env, profileConfig }) => {
      if (flags.baseUrl !== undefined) return 'flag';
      if (env.INSURUP_API_URL !== undefined) return 'environment';
      if (profileConfig.apiBaseUrl !== undefined) return 'config';
      return 'unset';
    },
    normalize: normalizeUrlFor('base-url'),
  },
  'browser-client-id': {
    key: 'browser-client-id',
    outputKey: 'browserClientId',
    envName: 'INSURUP_BROWSER_CLIENT_ID',
    profileKey: 'browserClientId',
    value: (config) => config.browserClientId,
    source: ({ env, profileConfig }) => {
      if (env.INSURUP_BROWSER_CLIENT_ID !== undefined) return 'environment';
      if (profileConfig.browserClientId !== undefined) return 'config';
      return 'default';
    },
    normalize: normalizeClientIdFor('browser-client-id'),
  },
};

const CONFIG_KEY_ALIASES: Record<string, ConfigKey> = {
  'auth-server': 'auth-server',
  authServer: 'auth-server',
  'auth-server-url': 'auth-server',
  'authorization-server': 'auth-server',
  authorizationServer: 'auth-server',
  'base-url': 'base-url',
  baseUrl: 'base-url',
  'api-base-url': 'base-url',
  apiBaseUrl: 'base-url',
  'browser-client-id': 'browser-client-id',
  browserClientId: 'browser-client-id',
  'browser-oauth-client-id': 'browser-client-id',
  'public-client-id': 'browser-client-id',
  publicClientId: 'browser-client-id',
};

function normalizeUrlFor(key: ConfigKey): (raw: string) => string {
  return (raw) => {
    const value = raw.trim();
    if (!value) throw new CliError(`${key} cannot be empty`, EXIT.USAGE);
    let url: URL;
    try {
      url = new URL(value);
    } catch {
      throw new CliError(`${key} must be a valid absolute URL`, EXIT.USAGE);
    }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      throw new CliError(`${key} must use http or https`, EXIT.USAGE);
    }
    return value;
  };
}

function normalizeClientIdFor(key: ConfigKey): (raw: string) => string {
  return (raw) => {
    const value = raw.trim();
    if (!value) throw new CliError(`${key} cannot be empty`, EXIT.USAGE);
    return value;
  };
}

function parseConfigKey(raw: string): ConfigKey {
  const key = CONFIG_KEY_ALIASES[raw];
  if (key) return key;
  throw new CliError(
    `Unknown config key "${raw}" (supported: ${Object.keys(CONFIG_ENTRIES).join(', ')})`,
    EXIT.USAGE,
  );
}

function params<F extends GlobalFlags, A extends readonly unknown[]>(
  positional?: unknown,
): TypedCommandParameters<F, A, LocalContext> {
  const parameters = positional
    ? { flags: { ...globalFlags }, positional }
    : { flags: { ...globalFlags } };
  return parameters as unknown as TypedCommandParameters<F, A, LocalContext>;
}

function tuple(...parameters: ReadonlyArray<{ brief: string; placeholder: string }>): unknown {
  return {
    kind: 'tuple',
    parameters: parameters.map(({ brief, placeholder }) => ({
      brief,
      placeholder,
      parse: String,
    })),
  };
}

function localCommand<F extends GlobalFlags, A extends readonly unknown[]>(
  brief: string,
  positional: unknown | undefined,
  run: (ctx: LocalContext, flags: F, ...args: A) => Promise<void>,
): Command<LocalContext> {
  return buildCommand<F, A, LocalContext>({
    docs: { brief },
    parameters: params<F, A>(positional),
    func: function (this: LocalContext, flags: F, ...args: A): Promise<void> {
      return runCommand(this, flags, () => run(this, flags, ...args));
    },
  });
}

function activeProfile(file: ConfigFile, flags: GlobalFlags, env: SourceArgs['env']): string {
  return resolveProfileName(flags, env, file);
}

function profileConfig(file: ConfigFile, profile: string): ProfileConfig {
  return file.profiles?.[profile] ?? {};
}

function describeEntry(
  entry: ConfigEntry,
  config: ResolvedConfig,
  sourceArgs: SourceArgs,
): Record<string, unknown> {
  return {
    key: entry.key,
    name: entry.outputKey,
    value: entry.value(config) ?? null,
    source: entry.source(sourceArgs),
    env: entry.envName,
  };
}

async function readEffectiveConfig(
  ctx: LocalContext,
  flags: GlobalFlags,
): Promise<{
  readonly file: ConfigFile;
  readonly profile: string;
  readonly profileConfig: ProfileConfig;
  readonly config: ResolvedConfig;
}> {
  const file = await readConfigFile(ctx.env);
  const profile = activeProfile(file, flags, ctx.env);
  return {
    file,
    profile,
    profileConfig: profileConfig(file, profile),
    config: resolveConfig({ flags, env: ctx.env, file }),
  };
}

function withoutEmptyProfiles(
  file: ConfigFile,
  profiles: Record<string, ProfileConfig>,
): ConfigFile {
  const cleaned = Object.fromEntries(
    Object.entries(profiles).filter(([, value]) => Object.keys(value).length > 0),
  );
  return {
    ...file,
    profiles: Object.keys(cleaned).length > 0 ? cleaned : undefined,
  };
}

const show = localCommand<GlobalFlags, []>(
  'Show effective CLI config for the active profile',
  undefined,
  async (ctx, flags) => {
    const { config, profileConfig } = await readEffectiveConfig(ctx, flags);
    const sourceArgs = { flags, env: ctx.env, profileConfig };
    printData(ctx, flags, {
      profile: config.profile,
      values: Object.values(CONFIG_ENTRIES).map((entry) =>
        describeEntry(entry, config, sourceArgs),
      ),
    });
  },
);

const get = localCommand<GlobalFlags, [string]>(
  'Show one effective CLI config value',
  tuple({ brief: 'Config key', placeholder: 'key' }),
  async (ctx, flags, rawKey) => {
    const entry = CONFIG_ENTRIES[parseConfigKey(rawKey)];
    const { config, profileConfig } = await readEffectiveConfig(ctx, flags);
    printData(ctx, flags, describeEntry(entry, config, { flags, env: ctx.env, profileConfig }));
  },
);

const set = localCommand<GlobalFlags, [string, string]>(
  'Persist one config value to the active profile',
  tuple(
    { brief: 'Config key', placeholder: 'key' },
    { brief: 'Config value', placeholder: 'value' },
  ),
  async (ctx, flags, rawKey, rawValue) => {
    const entry = CONFIG_ENTRIES[parseConfigKey(rawKey)];
    const file = await readConfigFile(ctx.env);
    const profile = activeProfile(file, flags, ctx.env);
    const profiles = { ...(file.profiles ?? {}) };
    profiles[profile] = {
      ...(profiles[profile] ?? {}),
      [entry.profileKey]: entry.normalize(rawValue),
    };
    await writeConfigFile({ ...file, profiles }, ctx.env);
    printSuccess(ctx, flags, `Set ${entry.key} for profile "${profile}"`);
  },
);

const unset = localCommand<GlobalFlags, [string]>(
  'Remove one config value from the active profile',
  tuple({ brief: 'Config key', placeholder: 'key' }),
  async (ctx, flags, rawKey) => {
    const entry = CONFIG_ENTRIES[parseConfigKey(rawKey)];
    const file = await readConfigFile(ctx.env);
    const profile = activeProfile(file, flags, ctx.env);
    const profiles = { ...(file.profiles ?? {}) };
    const nextProfile = { ...(profiles[profile] ?? {}) };
    delete nextProfile[entry.profileKey];
    profiles[profile] = nextProfile;
    await writeConfigFile(withoutEmptyProfiles(file, profiles), ctx.env);
    printSuccess(ctx, flags, `Unset ${entry.key} for profile "${profile}"`);
  },
);

export const configRoutes = buildRouteMap<string, LocalContext>({
  docs: { brief: 'Inspect and update local CLI config' },
  routes: {
    show,
    get,
    set,
    unset,
  },
});
