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

let server: MockServer;

beforeEach(() => {
  setSecretsBackend(memorySecrets({ 'com.insurup.cli m2m:default': 'secret' }));
  server = startMockServer();
  // GraphQL-aware + NoContent-aware generic responder.
  server.setApiHandler((req, url) => {
    if (url.pathname.endsWith('/graphql')) {
      return Response.json({
        data: {
          customersNew: {
            edges: [],
            pageInfo: {
              hasNextPage: false,
              hasPreviousPage: false,
              startCursor: null,
              endCursor: null,
            },
            totalCount: 0,
          },
        },
      });
    }
    if (req.method === 'PUT' || req.method === 'DELETE') return new Response(null, { status: 204 });
    return Response.json({ ok: true, items: [] });
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

// One+ representative command per module — exercises each handler end-to-end.
const commands: string[][] = [
  ['customers', 'list'],
  ['customers', 'get', 'c1'],
  ['customers', 'me'],
  ['customers', 'create', '--data', '{"type":"INDIVIDUAL"}'],
  ['customers', 'update', 'c1', '--data', '{}'],
  ['customers', 'delete', 'c1'],
  ['vehicles', 'list', 'c1'],
  ['vehicles', 'get', 'c1', 'v1'],
  ['vehicles', 'brands'],
  ['vehicles', 'add', '--data', '{}'],
  ['vehicles', 'models', '--data', '{"brandReference":"x","year":2020}'],
  ['vehicles', 'by-brand-code', 'BMW'],
  ['properties', 'list', 'c1'],
  ['properties', 'get', 'c1', 'p1'],
  ['properties', 'params', 'cities'],
  ['properties', 'params', 'districts', '--data', '{}'],
  ['properties', 'address', '123'],
  ['properties', 'dask', '456'],
  ['policies', 'get', 'p1'],
  ['policies', 'document', 'p1'],
  ['policies', 'analytics', 'premium', '--data', '{}'],
  ['policies', 'transfers', 'create', '--data', '{}'],
  ['proposals', 'get', 'pr1'],
  ['proposals', 'create', '--data', '{}'],
  ['proposals', 'coverage', 'pr1', 'prod1'],
  ['proposals', 'purchase-sync', '--data', '{}'],
  ['cases', 'get', 'REF1'],
  ['cases', 'activities', 'REF1'],
  ['cases', 'create-sale', '--data', '{}'],
  ['cases', 'note', '--data', '{}'],
  ['cases', 'analytics', 'funnel', '--data', '{}'],
  ['agents', 'me'],
  ['agents', 'update', '--data', '{}'],
  ['agents', 'insurance-companies', 'list'],
  ['agents', 'insurance-companies', 'branches', 'ic1'],
  ['agents', 'b2c-config', 'get'],
  ['agent-branches', 'list'],
  ['agent-branches', 'get', 'b1'],
  ['agent-branches', 'create', '--data', '{}'],
  ['agent-branches', 'delete', 'b1'],
  ['agent-roles', 'list'],
  ['agent-roles', 'delete', 'r1'],
  ['agent-setup', 'enter', '--data', '{}'],
  ['agent-users', 'me'],
  ['agent-users', 'get', 'u1'],
  ['agent-users', 'activate', 'u1'],
  ['agent-users', 'invite', '--data', '{}'],
  ['oauth-clients', 'list'],
  ['oauth-clients', 'create', '--data', '{}'],
  ['insurance', 'companies'],
  ['insurance', 'company-products', '5'],
  ['insurance', 'banks'],
  ['insurance', 'bank-branches', 'bank1'],
  ['coverage', 'groups', 'list'],
  ['coverage', 'groups', 'delete', 'cg1'],
  ['coverage', 'choices', 'kasko'],
  ['templates', 'list'],
  ['templates', 'get', 'key1', '1'],
  ['templates', 'delete', 'key1', '1'],
  ['languages', 'list'],
  ['webhooks', 'list'],
  ['webhooks', 'create', '--data', '{}'],
  ['webhooks', 'get', 'w1'],
  ['webhooks', 'update', '--data', '{}'],
  ['webhooks', 'delete', 'w1'],
  ['webhooks', 'deliveries', 'get', 'w1', 'd1'],
  ['webhooks', 'deliveries', 'redeliver', 'w1', 'd1'],
  // Additional handler variants to exercise the remaining command bodies.
  ['vehicles', 'update', '--data', '{}'],
  ['vehicles', 'delete', 'c1', 'v1'],
  ['vehicles', 'lookup', '--data', '{}'],
  ['properties', 'create', '--data', '{}'],
  ['properties', 'update', '--data', '{}'],
  ['properties', 'delete', 'c1', 'p1'],
  ['policies', 'send-document', '--data', '{}'],
  ['policies', 'set-representative', '--data', '{}'],
  ['policies', 'set-branch', '--data', '{}'],
  ['policies', 'create-manual', '--data', '{}'],
  ['policies', 'update-manual', '--data', '{}'],
  ['policies', 'transfers', 'get', '--data', '{}'],
  ['policies', 'transfers', 'trigger', '--data', '{}'],
  ['policies', 'analytics', 'renewal', '--data', '{}'],
  ['policies', 'analytics', 'distribution', '--data', '{}'],
  ['policies', 'analytics', 'earnings', '--data', '{}'],
  ['proposals', 'retry', 'pr1', 'prod1'],
  ['proposals', 'purchase-async', '--data', '{}'],
  ['proposals', 'revise', '--data', '{}'],
  ['proposals', 'set-representative', '--data', '{}'],
  ['proposals', 'set-branch', '--data', '{}'],
  ['proposals', 'conversion-trend', '--data', '{}'],
  ['cases', 'policies', 'REF1'],
  ['cases', 'proposals', 'REF1'],
  ['cases', 'create-cross-sale', '--data', '{}'],
  ['cases', 'create-cancel', '--data', '{}'],
  ['cases', 'create-endorsement', '--data', '{}'],
  ['cases', 'create-complaint', '--data', '{}'],
  ['cases', 'set-state', '--data', '{}'],
  ['cases', 'set-channel', '--data', '{}'],
  ['cases', 'set-asset', '--data', '{}'],
  ['cases', 'set-branch', '--data', '{}'],
  ['cases', 'set-representative', '--data', '{}'],
  ['cases', 'automations'],
  ['cases', 'priority-templates'],
  ['cases', 'analytics', 'backlog', '--data', '{}'],
  ['cases', 'analytics', 'failed', '--data', '{}'],
  ['agents', 'insurance-companies', 'add', '--data', '{}'],
  ['agents', 'insurance-companies', 'remove', 'ic1'],
  ['agents', 'insurance-companies', 'connection', 'ic1'],
  ['agents', 'insurance-companies', 'update-connection', '--data', '{}'],
  ['agents', 'insurance-companies', 'update-branches', '--data', '{}'],
  ['agents', 'insurance-companies', 'resync', '--data', '{}'],
  ['agents', 'b2c-config', 'update', '--data', '{}'],
  ['agent-branches', 'update', '--data', '{}'],
  ['agent-roles', 'get', 'r1'],
  ['agent-roles', 'create', '--data', '{}'],
  ['agent-roles', 'update', '--data', '{}'],
  ['agent-setup', 'complete', '--data', '{}'],
  ['agent-users', 'robot-code'],
  ['agent-users', 'update-me', '--data', '{}'],
  ['agent-users', 'update', '--data', '{}'],
  ['agent-users', 'accept-invite', '--data', '{}'],
  ['agent-users', 'resend-invite', 'u1'],
  ['agent-users', 'check-invite', 'code1'],
  ['agent-users', 'deactivate', 'u1'],
  ['agent-users', 'delete', 'u1'],
  ['agent-users', 'password', '--data', '{}'],
  ['oauth-clients', 'get', 'o1'],
  ['oauth-clients', 'update', '--data', '{}'],
  ['oauth-clients', 'delete', 'o1'],
  ['insurance', 'products'],
  ['insurance', 'connection-fields', '5'],
  ['insurance', 'resource-keys'],
  ['insurance', 'release-notes'],
  ['insurance', 'financial-institutions'],
  ['coverage', 'groups', 'get', 'cg1'],
  ['coverage', 'groups', 'create', '--data', '{}'],
  ['coverage', 'groups', 'update', '--data', '{}'],
  ['coverage', 'choices', 'konut'],
  ['coverage', 'choices', 'tss'],
  ['coverage', 'choices', 'imm'],
  ['templates', 'definitions'],
  ['templates', 'update', '--data', '{}'],
  ['properties', 'params', 'towns', '--data', '{}'],
  ['properties', 'params', 'neighborhoods', '--data', '{}'],
  ['properties', 'params', 'streets', '--data', '{}'],
];

describe('module command smoke (every module, success path)', () => {
  for (const args of commands) {
    test(`insurup ${args.join(' ')}`, async () => {
      const t = await runCli([...args, '--json']);
      expect(ok(t.exitCode())).toBe(true);
    });
  }
});

describe('targeted command behaviors', () => {
  test('whoami resolves identity from the agent-user endpoint', async () => {
    server.setApiHandler(() => Response.json({ id: 'u1', email: 'a@b.c' }));
    const t = await runCli(['auth', 'whoami', '--json']);
    expect(ok(t.exitCode())).toBe(true);
    expect(JSON.parse(t.stdout()).identityKind).toBe('agent-user');
  });

  test('whoami falls back to the customer endpoint', async () => {
    server.setApiHandler((_req, url) => {
      if (url.pathname.includes('agent')) return new Response('', { status: 401 });
      return Response.json({ id: 'cust1', fullName: 'Jane' });
    });
    const t = await runCli(['auth', 'whoami', '--json']);
    expect(ok(t.exitCode())).toBe(true);
    expect(JSON.parse(t.stdout()).identityKind).toBe('customer');
  });

  test('whoami exits 3 when everything is unauthorized', async () => {
    server.setApiHandler(() => new Response('', { status: 401 }));
    const t = await runCli(['auth', 'whoami', '--json']);
    expect(t.exitCode()).toBe(3);
  });

  test('logout clears the session', async () => {
    const t = await runCli(['auth', 'logout', '--json']);
    expect(ok(t.exitCode())).toBe(true);
    expect(JSON.parse(t.stdout())).toMatchObject({ ok: true });
  });

  test('reads --data from a @file', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'insurup-data-'));
    const file = join(dir, 'body.json');
    await Bun.write(file, '{"type":"INDIVIDUAL"}');
    const t = await runCli(['customers', 'create', '--data', `@${file}`, '--json']);
    expect(ok(t.exitCode())).toBe(true);
    await rm(dir, { recursive: true, force: true });
  });

  test('invalid --data JSON exits 2', async () => {
    const t = await runCli(['customers', 'create', '--data', '{not json', '--json']);
    expect(t.exitCode()).toBe(2);
  });

  test('uploads a file by path', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'insurup-up-'));
    const file = join(dir, 'hello.txt');
    await Bun.write(file, 'hello');
    server.setApiHandler(() => Response.json({ url: 'https://cdn/hello.txt' }));
    const t = await runCli(['files', 'upload', file, '--json']);
    expect(ok(t.exitCode())).toBe(true);
    expect(JSON.parse(t.stdout()).url).toBe('https://cdn/hello.txt');
    await rm(dir, { recursive: true, force: true });
  });
});
