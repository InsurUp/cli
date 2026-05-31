import type { DefaultInsurUpClient } from '@insurup/sdk';
import type { LocalContext } from '../context.ts';
import { printData, runCommand } from '../output/print.ts';
import { createSession } from '../session.ts';
import { CliError } from '../shared/errors.ts';
import { EXIT } from '../shared/exit-codes.ts';
import type { GlobalFlags } from '../shared/flags.ts';

export { ensureOk, take } from '../output/print.ts';

/** Local flag for passing a request body as JSON, `@file`, or `-` (stdin). */
export const dataFlag = {
  data: {
    kind: 'parsed',
    parse: String,
    brief: 'Request body: inline JSON, @file.json, or - for stdin',
    optional: true,
  },
} as const;

/** Local flags for cursor pagination on list/search commands. */
export const pageFlags = {
  first: { kind: 'parsed', parse: Number, brief: 'Max items to return', optional: true },
  after: { kind: 'parsed', parse: String, brief: 'Cursor to start after', optional: true },
} as const;

export type DataFlags = GlobalFlags & {
  readonly data?: string;
};

export type PageFlags = GlobalFlags & {
  readonly first?: number;
  readonly after?: string;
};

/** Read and JSON-parse the `--data` flag (inline / `@file` / `-` stdin). */
export async function readData(flags: DataFlags): Promise<unknown> {
  const raw = flags.data;
  if (raw === undefined) {
    throw new CliError('Missing --data (inline JSON, @file.json, or - for stdin)', EXIT.USAGE);
  }
  let text: string;
  if (raw === '-') {
    text = await Bun.stdin.text();
  } else if (raw.startsWith('@')) {
    text = await Bun.file(raw.slice(1)).text();
  } else {
    text = raw;
  }
  try {
    return JSON.parse(text);
  } catch (err) {
    throw new CliError(`Invalid JSON in --data: ${(err as Error).message}`, EXIT.USAGE);
  }
}

/** Like {@link readData}, but returns `undefined` when `--data` is absent. */
export async function optionalData(flags: DataFlags): Promise<unknown> {
  return flags.data === undefined ? undefined : readData(flags);
}

export interface ApiScope<F extends GlobalFlags> {
  readonly client: DefaultInsurUpClient;
  readonly ctx: LocalContext;
  readonly flags: F;
}

/**
 * Run a command body with an authenticated client, uniform error handling, and
 * automatic output: whatever the handler returns (if not `undefined`) is printed
 * via {@link printData}. Handlers that print their own success use `printSuccess`
 * and return nothing.
 */
export function withClient<F extends GlobalFlags>(
  ctx: LocalContext,
  flags: F,
  fn: (scope: ApiScope<F>) => unknown | Promise<unknown>,
): Promise<void> {
  return runCommand(ctx, flags, async () => {
    const { client } = await createSession(ctx, flags);
    const out = await fn({ client, ctx, flags });
    if (out !== undefined) printData(ctx, flags, out);
  });
}
