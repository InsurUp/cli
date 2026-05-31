import type { ClientError, GraphQLErrors, ServerError } from '@insurup/sdk';
import { InsurUpError } from '@insurup/sdk';
import { EXIT, type ExitCode } from './exit-codes.ts';

/**
 * A CLI-level error carrying the exit code to terminate with and optional
 * structured details (surfaced in `--json` mode). Thrown by command bodies and
 * caught centrally by {@link runCommand}; never propagates to the user as a stack trace.
 */
export class CliError extends Error {
  readonly exitCode: ExitCode;
  readonly details?: unknown;

  constructor(message: string, exitCode: ExitCode = EXIT.GENERIC, details?: unknown) {
    super(message);
    this.name = 'CliError';
    this.exitCode = exitCode;
    this.details = details;
  }
}

/** Map an InsurUp `ServerError` to an exit code by error type, then HTTP status. */
function serverErrorExitCode(err: ServerError): ExitCode {
  switch (err.type) {
    case 'Unauthorized':
    case 'AccessDenied':
      return EXIT.AUTH;
    case 'ResourceNotFound':
    case 'EndpointNotFound':
      return EXIT.NOT_FOUND;
    case 'InputValidation':
    case 'BusinessValidation':
    case 'ResourceDuplicate':
    case 'ResourceInvalidState':
    case 'UnsupportedMediaType':
    case 'MethodNotAllowed':
      return EXIT.USAGE;
    default:
      break;
  }
  if (err.status === 401 || err.status === 403) return EXIT.AUTH;
  if (err.status === 404) return EXIT.NOT_FOUND;
  if (err.status === 400 || err.status === 409 || err.status === 415 || err.status === 422) {
    return EXIT.USAGE;
  }
  return EXIT.API;
}

/** Map a GraphQL error response to an exit code by the first error's code. */
function graphqlErrorExitCode(err: GraphQLErrors): ExitCode {
  const code = err.errors[0]?.extensions?.code;
  switch (code) {
    case 'UNAUTHORIZED':
    case 'FORBIDDEN':
      return EXIT.AUTH;
    case 'NOT_FOUND':
      return EXIT.NOT_FOUND;
    case 'BAD_REQUEST':
    case 'VALIDATION_ERROR':
    case 'CONFLICT':
    case 'FILTER_REQUIRED':
    case 'FILTER_MAX_SPAN_EXCEEDED':
      return EXIT.USAGE;
    default:
      return EXIT.API;
  }
}

/** Client-side/transport errors are reported as API-class failures. */
function clientErrorExitCode(_err: ClientError): ExitCode {
  return EXIT.API;
}

/** Map an InsurUp SDK error object to a CLI exit code. */
export function exitCodeForInsurUpError(err: ClientError | ServerError | GraphQLErrors): ExitCode {
  switch (err.kind) {
    case 'server-error':
      return serverErrorExitCode(err);
    case 'graphql-error':
      return graphqlErrorExitCode(err);
    default:
      return clientErrorExitCode(err);
  }
}

/** Normalized, printable form of any thrown error. */
export interface NormalizedError {
  readonly exitCode: ExitCode;
  readonly message: string;
  readonly details?: unknown;
}

/** Normalize any thrown value into an exit code + message + optional details. */
export function normalizeError(err: unknown): NormalizedError {
  if (err instanceof CliError) {
    return { exitCode: err.exitCode, message: err.message, details: err.details };
  }
  if (err instanceof InsurUpError) {
    return {
      exitCode: exitCodeForInsurUpError(err.error),
      message: err.message,
      details: err.error,
    };
  }
  // OAuthError and any other Error: treat OAuth failures as auth errors.
  if (err instanceof Error) {
    const isOAuth = err.name === 'OAuthError';
    return { exitCode: isOAuth ? EXIT.AUTH : EXIT.GENERIC, message: err.message };
  }
  return { exitCode: EXIT.GENERIC, message: String(err) };
}
