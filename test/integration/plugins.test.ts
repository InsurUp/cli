import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { run } from '@stricli/core';
import { app } from '../../src/app.ts';
import { setSecretsBackend } from '../../src/auth/keychain-storage.ts';
import { makeContext, type TestContext } from '../helpers/context.ts';
import { memorySecrets } from '../helpers/memory-secrets.ts';
import { type MockServer, startMockServer } from '../helpers/mock-server.ts';

const PLUGIN_UUID = '0b0f9f6e-1111-4222-8333-444455556666';
const SLUG = 'com.acme.demo';

interface Recorded {
  readonly method: string;
  readonly path: string;
  readonly body: string;
}

let server: MockServer;
let requests: Recorded[];

/** Plugin detail as the API returns it (upload + get-by-id). */
const detail = (activeVersion: string | null) => ({
  id: PLUGIN_UUID,
  slug: SLUG,
  activeVersion,
  enabled: true,
  priority: 0,
  maskedConfigJson: null,
  createdAt: '2026-01-01T00:00:00Z',
  versions: [],
});

beforeEach(() => {
  setSecretsBackend(memorySecrets({ 'com.insurup.cli m2m:default': 'secret' }));
  server = startMockServer();
  requests = [];
  server.setApiHandler(async (req, url) => {
    requests.push({ method: req.method, path: url.pathname, body: await req.text() });
    const path = url.pathname.replace(/^\/api/, '');
    if (req.method === 'GET' && path === '/plugins') {
      return Response.json([
        {
          id: PLUGIN_UUID,
          slug: SLUG,
          activeVersion: '1.0.0',
          enabled: true,
          versionCount: 1,
          hooks: [],
          priority: 0,
        },
      ]);
    }
    if (req.method === 'POST' && path === '/plugins') return Response.json(detail(null));
    if (req.method === 'POST' && /^\/plugins\/[^/]+\/activate$/.test(path)) {
      return new Response(null, { status: 204 });
    }
    if (req.method === 'GET' && path === `/plugins/${PLUGIN_UUID}`) {
      return Response.json(detail('1.2.0'));
    }
    return new Response('not found', { status: 404 });
  });
});
afterEach(() => {
  server.stop();
});

async function runCli(args: string[]): Promise<TestContext> {
  const t = makeContext({
    INSURUP_AUTH_SERVER: server.authServer,
    INSURUP_API_URL: server.apiBaseUrl,
    INSURUP_CLIENT_ID: 'test',
    INSURUP_TOKEN_ENDPOINT: `${server.authServer}/connect/token`,
    INSURUP_AUTHORIZATION_ENDPOINT: `${server.authServer}/connect/authorize`,
  });
  await run(app, args, t.ctx);
  return t;
}

const ok = (code: number | undefined) => code === undefined || code === 0;

const activateCalls = () =>
  requests.filter((r) => r.method === 'POST' && r.path.endsWith('/activate'));
const listCalls = () => requests.filter((r) => r.method === 'GET' && r.path === '/api/plugins');

/** A minimal buildable plugin project (build script needs no dependencies). */
async function makePluginDir(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'insurup-plugin-'));
  await Bun.write(
    join(dir, 'plugin.json'),
    JSON.stringify({ id: SLUG, version: '1.2.0', entry: 'index.js', contractVersion: '1.0.0' }),
  );
  await Bun.write(
    join(dir, 'build.js'),
    "await Bun.write('dist/index.js', 'export function onCustomerCreated() {}\\n');",
  );
  await Bun.write(
    join(dir, 'package.json'),
    JSON.stringify({ name: 'demo', scripts: { build: 'bun build.js' } }),
  );
  return dir;
}

/** Run `fn` with the process chdir'd into `dir`. */
async function inDir<T>(dir: string, fn: () => Promise<T>): Promise<T> {
  const prev = process.cwd();
  process.chdir(dir);
  try {
    return await fn();
  } finally {
    process.chdir(prev);
  }
}

describe('plugins activate', () => {
  test('a UUID --plugin activates directly without listing', async () => {
    const t = await runCli(['plugins', 'activate', '1.2.0', '--plugin', PLUGIN_UUID, '--json']);
    expect(ok(t.exitCode())).toBe(true);
    expect(listCalls()).toHaveLength(0);
    expect(activateCalls()).toHaveLength(1);
    expect(activateCalls()[0]?.path).toBe(`/api/plugins/${PLUGIN_UUID}/activate`);
    expect(JSON.parse(activateCalls()[0]?.body ?? '{}')).toEqual({ version: '1.2.0' });
  });

  test('a package-name --plugin resolves to the installed plugin id', async () => {
    const t = await runCli(['plugins', 'activate', '1.2.0', '--plugin', SLUG, '--json']);
    expect(ok(t.exitCode())).toBe(true);
    expect(listCalls()).toHaveLength(1);
    expect(activateCalls()[0]?.path).toBe(`/api/plugins/${PLUGIN_UUID}/activate`);
    expect(JSON.parse(t.stdout())).toMatchObject({ ok: true });
  });

  test('without --plugin the name comes from ./plugin.json', async () => {
    const dir = await makePluginDir();
    const t = await inDir(dir, () => runCli(['plugins', 'activate', '1.2.0', '--json']));
    expect(ok(t.exitCode())).toBe(true);
    expect(activateCalls()[0]?.path).toBe(`/api/plugins/${PLUGIN_UUID}/activate`);
    await rm(dir, { recursive: true, force: true });
  });

  test('an unknown package name exits 2', async () => {
    const t = await runCli(['plugins', 'activate', '1.2.0', '--plugin', 'com.acme.nope', '--json']);
    expect(t.exitCode()).toBe(2);
    expect(t.stderr()).toContain('No installed plugin named');
    expect(t.stderr()).toContain('com.acme.nope');
    expect(activateCalls()).toHaveLength(0);
  });

  test('outside a plugin directory without --plugin exits 2 with a hint', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'insurup-empty-'));
    const t = await inDir(dir, () => runCli(['plugins', 'activate', '1.2.0', '--json']));
    expect(t.exitCode()).toBe(2);
    expect(t.stderr()).toContain('--plugin');
    await rm(dir, { recursive: true, force: true });
  });
});

describe('plugins deploy', () => {
  test('deploys from cwd and activates the uploaded version by default', async () => {
    const dir = await makePluginDir();
    const t = await inDir(dir, () => runCli(['plugins', 'deploy', '--json']));
    expect(ok(t.exitCode())).toBe(true);
    const uploads = requests.filter((r) => r.method === 'POST' && r.path === '/api/plugins');
    expect(uploads).toHaveLength(1);
    expect(activateCalls()).toHaveLength(1);
    expect(JSON.parse(activateCalls()[0]?.body ?? '{}')).toEqual({ version: '1.2.0' });
    // Returned detail is re-fetched after activation (stdout carries the
    // success object + the detail, so assert on the rendered text).
    expect(t.stdout()).toContain('"activeVersion": "1.2.0"');
    await rm(dir, { recursive: true, force: true });
  });

  test('--no-activate uploads without activating', async () => {
    const dir = await makePluginDir();
    const t = await inDir(dir, () => runCli(['plugins', 'deploy', '--no-activate', '--json']));
    expect(ok(t.exitCode())).toBe(true);
    expect(activateCalls()).toHaveLength(0);
    // No re-fetch: the upload response (no active version yet) is returned as-is.
    expect(t.stdout()).toContain('"activeVersion": null');
    await rm(dir, { recursive: true, force: true });
  });

  test('still accepts an explicit directory argument', async () => {
    const dir = await makePluginDir();
    const t = await runCli(['plugins', 'deploy', dir, '--json']);
    expect(ok(t.exitCode())).toBe(true);
    expect(activateCalls()).toHaveLength(1);
    await rm(dir, { recursive: true, force: true });
  });
});

describe('plugins build', () => {
  test('builds from cwd without a directory argument', async () => {
    const dir = await makePluginDir();
    const t = await inDir(dir, () => runCli(['plugins', 'build', '--json']));
    expect(ok(t.exitCode())).toBe(true);
    expect(await Bun.file(join(dir, 'dist', `${SLUG}.zip`)).exists()).toBe(true);
    await rm(dir, { recursive: true, force: true });
  });
});
