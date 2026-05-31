import { describe, expect, test } from 'bun:test';
import type { ServerError } from '@insurup/sdk';
import {
  ensureOk,
  printData,
  printError,
  printSuccess,
  runCommand,
  take,
  unwrap,
} from '../../src/output/print.ts';
import { CliError, normalizeError } from '../../src/shared/errors.ts';
import { EXIT } from '../../src/shared/exit-codes.ts';
import type { GlobalFlags } from '../../src/shared/flags.ts';
import { makeContext } from '../helpers/context.ts';

const base: GlobalFlags = { json: false, quiet: false, color: false, verbose: false };
const jsonFlags: GlobalFlags = { ...base, json: true };

const serverFailure = {
  kind: 'server-error',
  isSuccess: false,
  message: 'not found',
  type: 'ResourceNotFound',
  typeString: '',
  title: '',
  detail: '',
  instance: '',
  status: 404,
  codes: [],
  traceId: undefined,
  template: '',
  templateArgs: {},
  suggestions: [],
  validationErrors: [],
} as unknown as ServerError;

describe('unwrap / take / ensureOk', () => {
  test('unwrap returns data on success', () => {
    expect(unwrap({ isSuccess: true, data: { id: 1 } })).toEqual({ id: 1 });
  });
  test('unwrap throws a mapped CliError on failure', () => {
    try {
      unwrap(serverFailure);
      throw new Error('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(CliError);
      expect((e as CliError).exitCode).toBe(EXIT.NOT_FOUND);
    }
  });
  test('take awaits and unwraps', async () => {
    expect(await take(Promise.resolve({ isSuccess: true, data: 'ok' }))).toBe('ok');
  });
  test('ensureOk throws on failure, returns void on success', () => {
    expect(ensureOk({ isSuccess: true })).toBeUndefined();
    expect(() => ensureOk(serverFailure)).toThrow(CliError);
  });
});

describe('printData', () => {
  test('writes pretty JSON to stdout in json mode', () => {
    const t = makeContext();
    printData(t.ctx, jsonFlags, { a: 1 });
    expect(t.stdout()).toBe('{\n  "a": 1\n}\n');
  });
  test('writes a human table in default mode', () => {
    const t = makeContext();
    printData(t.ctx, base, [{ id: 1 }]);
    expect(t.stdout()).toContain('id');
  });
  test('renders a GraphQL connection’s nodes + stderr footer', () => {
    const t = makeContext();
    printData(t.ctx, base, {
      edges: [{ node: { id: 1 } }],
      totalCount: 5,
      pageInfo: { hasNextPage: true, endCursor: 'C' },
    });
    expect(t.stdout()).toContain('id');
    expect(t.stderr()).toContain('1 item(s) of 5');
    expect(t.stderr()).toContain('--after C');
  });
});

describe('printSuccess / printError / runCommand', () => {
  test('printSuccess in json goes to stdout', () => {
    const t = makeContext();
    printSuccess(t.ctx, jsonFlags, 'done');
    expect(JSON.parse(t.stdout())).toEqual({ ok: true, message: 'done' });
  });
  test('printSuccess human goes to stderr, suppressed by quiet', () => {
    const t = makeContext();
    printSuccess(t.ctx, base, 'done');
    expect(t.stderr()).toContain('done');
    const q = makeContext();
    printSuccess(q.ctx, { ...base, quiet: true }, 'done');
    expect(q.stderr()).toBe('');
  });
  test('printError json writes an error object to stderr', () => {
    const t = makeContext();
    printError(t.ctx, jsonFlags, normalizeError(new CliError('boom', EXIT.USAGE)));
    expect(JSON.parse(t.stderr())).toEqual({
      error: { message: 'boom', exitCode: EXIT.USAGE, details: undefined },
    });
  });
  test('runCommand prints error and sets exit code on throw', async () => {
    const t = makeContext();
    await runCommand(t.ctx, base, () => {
      throw new CliError('nope', EXIT.AUTH);
    });
    expect(t.exitCode()).toBe(EXIT.AUTH);
    expect(t.stderr()).toContain('nope');
  });
  test('runCommand leaves exit code unset on success', async () => {
    const t = makeContext();
    await runCommand(t.ctx, base, () => {
      /* ok */
    });
    expect(t.exitCode()).toBeUndefined();
  });
});
