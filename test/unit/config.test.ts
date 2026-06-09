import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  DEFAULT_SCOPES,
  readConfigFile,
  resolveConfig,
  resolveProfileName,
  writeConfigFile,
} from '../../src/config/config.ts';
import { configFilePath } from '../../src/config/paths.ts';
import type { GlobalFlags } from '../../src/shared/flags.ts';

const baseFlags: GlobalFlags = { json: false, quiet: false, color: true, verbose: false };

describe('resolveProfileName', () => {
  test('prefers flag over env over file over default', () => {
    expect(
      resolveProfileName(
        { profile: 'flag' },
        { INSURUP_PROFILE: 'env' },
        { defaultProfile: 'file' },
      ),
    ).toBe('flag');
    expect(resolveProfileName({}, { INSURUP_PROFILE: 'env' }, { defaultProfile: 'file' })).toBe(
      'env',
    );
    expect(resolveProfileName({}, {}, { defaultProfile: 'file' })).toBe('file');
    expect(resolveProfileName({}, {}, {})).toBe('default');
  });
});

describe('resolveConfig precedence', () => {
  test('flags beat env beat file beat defaults', () => {
    const cfg = resolveConfig({
      flags: {
        ...baseFlags,
        clientId: 'flag-id',
        authServer: 'https://flag',
        baseUrl: 'https://flag-api',
      },
      env: {
        INSURUP_CLIENT_ID: 'env-id',
        INSURUP_AUTH_SERVER: 'https://env',
        INSURUP_API_URL: 'https://env-api',
      },
      file: { profiles: { default: { clientId: 'file-id', apiBaseUrl: 'https://file-api' } } },
    });
    expect(cfg.clientId).toBe('flag-id');
    expect(cfg.authServer).toBe('https://flag');
    expect(cfg.apiBaseUrl).toBe('https://flag-api');
  });

  test('falls back to env then file then defaults', () => {
    const cfg = resolveConfig({
      flags: baseFlags,
      env: { INSURUP_CLIENT_ID: 'env-id' },
      file: { profiles: { default: { authServer: 'https://file-auth' } } },
    });
    expect(cfg.clientId).toBe('env-id');
    expect(cfg.authServer).toBe('https://file-auth');
    expect(cfg.scopes).toEqual([...DEFAULT_SCOPES]);
  });

  test('reads client secret only from env', () => {
    const cfg = resolveConfig({ flags: baseFlags, env: { INSURUP_CLIENT_SECRET: 's3cret' } });
    expect(cfg.clientSecret).toBe('s3cret');
  });

  test('parses INSURUP_SCOPES (comma or space separated)', () => {
    expect(resolveConfig({ flags: baseFlags, env: { INSURUP_SCOPES: 'a, b  c' } }).scopes).toEqual([
      'a',
      'b',
      'c',
    ]);
  });

  test('timeout flag beats env, ignores non-positive', () => {
    expect(
      resolveConfig({ flags: { ...baseFlags, timeout: 5000 }, env: { INSURUP_TIMEOUT: '9000' } })
        .timeoutMs,
    ).toBe(5000);
    expect(
      resolveConfig({ flags: baseFlags, env: { INSURUP_TIMEOUT: '0' } }).timeoutMs,
    ).toBeUndefined();
    expect(
      resolveConfig({ flags: baseFlags, env: { INSURUP_TIMEOUT: 'abc' } }).timeoutMs,
    ).toBeUndefined();
  });

  test('resolves the selected profile’s settings', () => {
    const cfg = resolveConfig({
      flags: { ...baseFlags, profile: 'staging' },
      env: {},
      file: {
        profiles: {
          default: { clientId: 'd' },
          staging: { clientId: 'st', authServer: 'https://st' },
        },
      },
    });
    expect(cfg.profile).toBe('staging');
    expect(cfg.clientId).toBe('st');
  });
});

describe('config file IO', () => {
  let dir: string;
  let env: Record<string, string>;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'insurup-cfg-'));
    env = { XDG_CONFIG_HOME: dir };
  });
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  test('returns {} when file is missing', async () => {
    expect(await readConfigFile(env)).toEqual({});
  });

  test('round-trips written config and writes under XDG dir', async () => {
    await writeConfigFile({ defaultProfile: 'p', profiles: { p: { clientId: 'x' } } }, env);
    expect(configFilePath(env)).toBe(join(dir, 'insurup', 'config.json'));
    expect(await readConfigFile(env)).toEqual({
      defaultProfile: 'p',
      profiles: { p: { clientId: 'x' } },
    });
  });

  test('returns {} on malformed JSON', async () => {
    await writeConfigFile({ defaultProfile: 'p' }, env);
    await Bun.write(configFilePath(env), '{ not json');
    expect(await readConfigFile(env)).toEqual({});
  });
});
