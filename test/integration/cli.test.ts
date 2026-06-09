import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { run } from '@stricli/core';
import { app } from '../../src/app.ts';
import { getClientSecret, setSecretsBackend } from '../../src/auth/keychain-storage.ts';
import { readConfigFile } from '../../src/config/config.ts';
import { makeContext, type TestContext } from '../helpers/context.ts';
import { memorySecrets } from '../helpers/memory-secrets.ts';
import { type MockServer, startMockServer } from '../helpers/mock-server.ts';

let server: MockServer;

beforeEach(() => {
  setSecretsBackend(memorySecrets());
  server = startMockServer();
});
afterEach(() => {
  server.stop();
});

/** Run the CLI against the mock server (config supplied via env); returns captured IO. */
async function runCli(args: string[]): Promise<TestContext> {
  const t = makeContext({
    INSURUP_AUTH_SERVER: server.authServer,
    INSURUP_API_URL: server.apiBaseUrl,
    // Explicit endpoints so the SDK skips HTTPS-only OIDC discovery against the http mock.
    INSURUP_TOKEN_ENDPOINT: `${server.authServer}/connect/token`,
    INSURUP_AUTHORIZATION_ENDPOINT: `${server.authServer}/connect/authorize`,
  });
  await run(app, args, t.ctx);
  return t;
}

/** Success through stricli's `run` leaves exit code 0 (or unset). */
const ok = (code: number | undefined) => code === undefined || code === 0;

describe('end-to-end command routing', () => {
  test('ping works', async () => {
    const t = makeContext();
    await run(app, ['ping', '--json'], t.ctx);
    expect(JSON.parse(t.stdout())).toEqual({ ok: true, message: 'pong' });
    expect(ok(t.exitCode())).toBe(true);
  });

  test('M2M login acquires and stores a token', async () => {
    const t = await runCli([
      'auth',
      'login',
      '--m2m',
      '--client-id',
      'test',
      '--client-secret',
      'secret',
      '--json',
    ]);
    expect(ok(t.exitCode())).toBe(true);
    expect(server.tokenRequestCount()).toBeGreaterThan(0);
    const out = JSON.parse(t.stdout());
    expect(out.ok).toBe(true);
    expect(out.flow).toBe('client_credentials');

    // status reflects the stored session
    const status = await runCli(['auth', 'status', '--json']);
    expect(JSON.parse(status.stdout()).authenticated).toBe(true);

    // `auth token` prints the access token
    const token = await runCli(['auth', 'token']);
    expect(token.stdout().trim()).toBe('mock-access-token');
  });

  test('M2M login --save persists the secret and profile settings', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'insurup-save-'));
    const t = makeContext({
      XDG_CONFIG_HOME: dir,
      INSURUP_TOKEN_ENDPOINT: `${server.authServer}/connect/token`,
    });
    await run(
      app,
      [
        'auth',
        'login',
        '--m2m',
        '--client-id',
        'svc',
        '--client-secret',
        'sek',
        '--save',
        '--auth-server',
        server.authServer,
        '--json',
      ],
      t.ctx,
    );
    expect(ok(t.exitCode())).toBe(true);
    expect(await getClientSecret('default')).toBe('sek');
    const file = await readConfigFile({ XDG_CONFIG_HOME: dir });
    expect(file.profiles?.default?.clientId).toBe('svc');
    await rm(dir, { recursive: true, force: true });
  });

  test('config set/get/unset base-url persists profile settings', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'insurup-config-'));
    try {
      const env = { XDG_CONFIG_HOME: dir };
      const set = makeContext(env);
      await run(
        app,
        ['config', 'set', 'base-url', 'https://api.example.test/v1', '--json'],
        set.ctx,
      );
      expect(ok(set.exitCode())).toBe(true);
      expect((await readConfigFile(env)).profiles?.default?.apiBaseUrl).toBe(
        'https://api.example.test/v1',
      );

      const get = makeContext(env);
      await run(app, ['config', 'get', 'base-url', '--json'], get.ctx);
      expect(JSON.parse(get.stdout())).toEqual({
        key: 'base-url',
        name: 'baseUrl',
        value: 'https://api.example.test/v1',
        source: 'config',
        env: 'INSURUP_API_URL',
      });

      const unset = makeContext(env);
      await run(app, ['config', 'unset', 'base-url', '--json'], unset.ctx);
      expect(ok(unset.exitCode())).toBe(true);
      expect((await readConfigFile(env)).profiles?.default?.apiBaseUrl).toBeUndefined();
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  test('auth token without a session exits 3', async () => {
    const t = await runCli(['auth', 'token']);
    expect(t.exitCode()).toBe(3);
    expect(t.stderr()).toContain('Not authenticated');
  });

  test('login without a client id exits 2', async () => {
    const t = await runCli(['auth', 'login', '--m2m', '--client-secret', 'x', '--json']);
    expect(t.exitCode()).toBe(2);
    expect(JSON.parse(t.stderr()).error.message).toContain('client id');
  });

  test('browser login rejects --save (M2M only)', async () => {
    const t = await runCli(['auth', 'login', '--save', '--json']);
    expect(t.exitCode()).toBe(2);
    expect(JSON.parse(t.stderr()).error.message).toContain('--save');
  });

  test('a successful API list prints data (json)', async () => {
    server.setApiHandler(() => Response.json([{ id: 'tr', name: 'Turkish' }]));
    const t = await runCli(['languages', 'list', '--json']);
    expect(ok(t.exitCode())).toBe(true);
    expect(JSON.parse(t.stdout())).toEqual([{ id: 'tr', name: 'Turkish' }]);
  });

  test('a 404 from the API maps to exit 4', async () => {
    server.setApiHandler(() => new Response('', { status: 404 }));
    const t = await runCli(['customers', 'get', 'missing', '--json']);
    expect(t.exitCode()).toBe(4);
  });

  test('a 401 from the API maps to exit 3', async () => {
    server.setApiHandler(() => new Response('', { status: 401 }));
    const t = await runCli(['languages', 'list', '--json']);
    expect(t.exitCode()).toBe(3);
  });

  test('a 500 from the API maps to exit 5', async () => {
    server.setApiHandler(() => new Response('', { status: 500 }));
    const t = await runCli(['languages', 'list']);
    expect(t.exitCode()).toBe(5);
  });

  test('unknown command exits non-zero', async () => {
    const t = await runCli(['not-a-real-command']);
    expect(t.exitCode()).not.toBe(0);
  });
});
