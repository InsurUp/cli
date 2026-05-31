import type { ClientError, GraphQLErrors, ServerError } from '@insurup/sdk';
import type { LocalContext } from '../context.ts';
import { CliError, exitCodeForInsurUpError, normalizeError } from '../shared/errors.ts';
import type { GlobalFlags } from '../shared/flags.ts';
import { colorsFor } from './colors.ts';
import { formatHuman, formatJson } from './format.ts';

/** A minimal result shape: success (optionally with data) or an SDK failure. */
type ResultLike = { readonly isSuccess: boolean; readonly message?: string };

/** Distribute over a result union to recover the success payload type. */
type DataOf<R> = R extends { readonly isSuccess: true; readonly data: infer D } ? D : never;

function writeOut(ctx: LocalContext, text: string): void {
  ctx.process.stdout.write(text.endsWith('\n') ? text : `${text}\n`);
}

function writeErr(ctx: LocalContext, text: string): void {
  ctx.process.stderr.write(text.endsWith('\n') ? text : `${text}\n`);
}

interface Connection {
  readonly nodes: unknown[];
  readonly totalCount?: number;
  readonly pageInfo?: { readonly hasNextPage?: boolean; readonly endCursor?: string };
}

/** Detect a Relay-style GraphQL connection (`{ edges:[{node}] }` or `{ nodes }`). */
function asConnection(data: unknown): Connection | null {
  if (typeof data !== 'object' || data === null || Array.isArray(data)) return null;
  const obj = data as Record<string, unknown>;
  if (Array.isArray(obj.edges)) {
    const nodes = (obj.edges as Array<{ node?: unknown }>).map((e) => e?.node ?? e);
    return {
      nodes,
      totalCount: obj.totalCount as number,
      pageInfo: obj.pageInfo as Connection['pageInfo'],
    };
  }
  if (Array.isArray(obj.nodes)) {
    return {
      nodes: obj.nodes,
      totalCount: obj.totalCount as number,
      pageInfo: obj.pageInfo as Connection['pageInfo'],
    };
  }
  return null;
}

/**
 * Print successful data to stdout — JSON when `--json`, otherwise a human table
 * or key/value block. GraphQL connections render their nodes as a table with a
 * pagination footer on stderr. stdout carries only data, keeping pipelines clean.
 */
export function printData(ctx: LocalContext, flags: GlobalFlags, data: unknown): void {
  if (flags.json) {
    writeOut(ctx, formatJson(data ?? null));
    return;
  }
  if (data === undefined || data === null) return;
  const colors = colorsFor(flags);

  const connection = asConnection(data);
  if (connection) {
    writeOut(ctx, formatHuman(connection.nodes, colors));
    if (!flags.quiet) {
      const total = connection.totalCount != null ? ` of ${connection.totalCount}` : '';
      const next = connection.pageInfo?.hasNextPage
        ? ` · more: --after ${connection.pageInfo.endCursor}`
        : '';
      writeErr(ctx, colors.dim(`${connection.nodes.length} item(s)${total}${next}`));
    }
    return;
  }
  writeOut(ctx, formatHuman(data, colors));
}

/**
 * Report a successful no-data action (delete, send, etc.). JSON goes to stdout;
 * the human confirmation goes to stderr so stdout stays empty for scripts.
 */
export function printSuccess(ctx: LocalContext, flags: GlobalFlags, message: string): void {
  if (flags.json) {
    writeOut(ctx, formatJson({ ok: true, message }));
    return;
  }
  if (!flags.quiet) writeErr(ctx, colorsFor(flags).green(`✓ ${message}`));
}

/** Print an informational note to stderr (suppressed by `--quiet` / `--json`). */
export function printNote(ctx: LocalContext, flags: GlobalFlags, message: string): void {
  if (flags.quiet || flags.json) return;
  writeErr(ctx, colorsFor(flags).dim(message));
}

/** Print a normalized error to stderr (JSON object when `--json`). */
export function printError(
  ctx: LocalContext,
  flags: GlobalFlags,
  error: ReturnType<typeof normalizeError>,
): void {
  if (flags.json) {
    writeErr(
      ctx,
      formatJson({
        error: { message: error.message, exitCode: error.exitCode, details: error.details },
      }),
    );
    return;
  }
  const colors = colorsFor(flags);
  writeErr(ctx, colors.red(`✖ ${error.message}`));
  if (flags.verbose && error.details !== undefined) {
    writeErr(ctx, colors.dim(formatJson(error.details)));
  }
}

/**
 * Unwrap an InsurUp result, returning its data or throwing a {@link CliError}
 * mapped to the right exit code. Drives the consistent error handling in
 * {@link runCommand}. The return type is recovered from the full result union,
 * so methods whose success payload is itself a union still type correctly.
 */
export function unwrap<R extends ResultLike>(result: R): DataOf<R> {
  if (result.isSuccess) {
    return (result as { data?: DataOf<R> }).data as DataOf<R>;
  }
  const failure = result as unknown as ServerError | ClientError | GraphQLErrors;
  throw new CliError(failure.message, exitCodeForInsurUpError(failure), failure);
}

/** Await an SDK call and unwrap it in one step. */
export async function take<R extends ResultLike>(promise: Promise<R>): Promise<DataOf<R>> {
  return unwrap(await promise);
}

/** Throw a mapped {@link CliError} if the result failed; otherwise return void. */
export function ensureOk(result: ResultLike): void {
  if (result.isSuccess) return;
  const failure = result as unknown as ServerError | ClientError | GraphQLErrors;
  throw new CliError(failure.message, exitCodeForInsurUpError(failure), failure);
}

/**
 * Execute a command body with uniform error handling: on any throw, print the
 * normalized error and set the process exit code (stricli leaves a pre-set
 * `process.exitCode` untouched). Never rethrows, so stack traces never leak.
 */
export async function runCommand(
  ctx: LocalContext,
  flags: GlobalFlags,
  fn: () => void | Promise<void>,
): Promise<void> {
  try {
    await fn();
  } catch (err) {
    const normalized = normalizeError(err);
    printError(ctx, flags, normalized);
    ctx.process.exitCode = normalized.exitCode;
  }
}
