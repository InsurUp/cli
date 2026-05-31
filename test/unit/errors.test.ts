import { describe, expect, test } from 'bun:test';
import type { ClientError, ServerError } from '@insurup/sdk';
import { InsurUpError } from '@insurup/sdk';
import { CliError, exitCodeForInsurUpError, normalizeError } from '../../src/shared/errors.ts';
import { EXIT } from '../../src/shared/exit-codes.ts';

function serverError(partial: Record<string, unknown>): ServerError {
  return {
    kind: 'server-error',
    isSuccess: false,
    message: 'err',
    type: 'Unknown',
    typeString: '',
    title: '',
    detail: '',
    instance: '',
    status: 500,
    codes: [],
    traceId: undefined,
    template: '',
    templateArgs: {},
    suggestions: [],
    validationErrors: [],
    ...partial,
  } as unknown as ServerError;
}

describe('exitCodeForInsurUpError — server errors', () => {
  test('maps by error type', () => {
    expect(exitCodeForInsurUpError(serverError({ type: 'Unauthorized' }))).toBe(EXIT.AUTH);
    expect(exitCodeForInsurUpError(serverError({ type: 'AccessDenied' }))).toBe(EXIT.AUTH);
    expect(exitCodeForInsurUpError(serverError({ type: 'ResourceNotFound' }))).toBe(EXIT.NOT_FOUND);
    expect(exitCodeForInsurUpError(serverError({ type: 'InputValidation' }))).toBe(EXIT.USAGE);
    expect(exitCodeForInsurUpError(serverError({ type: 'Upstream' }))).toBe(EXIT.API);
  });

  test('falls back to HTTP status', () => {
    expect(exitCodeForInsurUpError(serverError({ type: 'Unknown', status: 401 }))).toBe(EXIT.AUTH);
    expect(exitCodeForInsurUpError(serverError({ type: 'Unknown', status: 404 }))).toBe(
      EXIT.NOT_FOUND,
    );
    expect(exitCodeForInsurUpError(serverError({ type: 'Unknown', status: 409 }))).toBe(EXIT.USAGE);
    expect(exitCodeForInsurUpError(serverError({ type: 'Unknown', status: 503 }))).toBe(EXIT.API);
  });
});

describe('exitCodeForInsurUpError — graphql & client errors', () => {
  test('graphql maps by first error code', () => {
    const gql = (code: string) => ({
      kind: 'graphql-error' as const,
      isSuccess: false as const,
      message: 'g',
      errors: [{ message: 'g', extensions: { code } }],
    });
    expect(exitCodeForInsurUpError(gql('UNAUTHORIZED') as never)).toBe(EXIT.AUTH);
    expect(exitCodeForInsurUpError(gql('NOT_FOUND') as never)).toBe(EXIT.NOT_FOUND);
    expect(exitCodeForInsurUpError(gql('BAD_REQUEST') as never)).toBe(EXIT.USAGE);
    expect(exitCodeForInsurUpError(gql('INTERNAL_ERROR') as never)).toBe(EXIT.API);
  });

  test('client/transport errors map to API', () => {
    const client = {
      kind: 'client-error',
      isSuccess: false,
      message: 'boom',
      type: 'Timeout',
    } as unknown as ClientError;
    expect(exitCodeForInsurUpError(client)).toBe(EXIT.API);
  });
});

describe('normalizeError', () => {
  test('CliError keeps its exit code and details', () => {
    const n = normalizeError(new CliError('nope', EXIT.USAGE, { field: 'x' }));
    expect(n).toEqual({ exitCode: EXIT.USAGE, message: 'nope', details: { field: 'x' } });
  });

  test('InsurUpError maps via its inner error', () => {
    const err = new InsurUpError(serverError({ type: 'ResourceNotFound', message: 'missing' }));
    const n = normalizeError(err);
    expect(n.exitCode).toBe(EXIT.NOT_FOUND);
    expect(n.message).toBe('missing');
  });

  test('OAuthError-shaped error maps to AUTH', () => {
    const e = new Error('bad grant');
    e.name = 'OAuthError';
    expect(normalizeError(e).exitCode).toBe(EXIT.AUTH);
  });

  test('unknown error maps to GENERIC', () => {
    expect(normalizeError('weird').exitCode).toBe(EXIT.GENERIC);
    expect(normalizeError(new Error('x')).exitCode).toBe(EXIT.GENERIC);
  });
});
