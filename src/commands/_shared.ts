import type { DefaultInsurUpClient } from '@insurup/sdk';
import type { LocalContext } from '../context.ts';
import { colorsFor } from '../output/colors.ts';
import { formatHuman, formatJson } from '../output/format.ts';
import { asConnection, printData, runCommand } from '../output/print.ts';
import { createSession } from '../session.ts';
import { CliError } from '../shared/errors.ts';
import { EXIT } from '../shared/exit-codes.ts';
import type { GlobalFlags } from '../shared/flags.ts';
import { confirm } from '../shared/prompt.ts';

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

/** Local flags for cursor pagination + free-text search on GraphQL list commands. */
export const listFlags = {
  first: {
    kind: 'parsed',
    parse: Number,
    brief: 'Page size (default 20, max 100)',
    optional: true,
  },
  after: { kind: 'parsed', parse: String, brief: 'Cursor to start after', optional: true },
  search: { kind: 'parsed', parse: String, brief: 'Free-text search query', optional: true },
} as const;

export type DataFlags = GlobalFlags & {
  readonly data?: string;
};

export type ListFlags = GlobalFlags & {
  readonly first?: number;
  readonly after?: string;
  readonly search?: string;
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

// ── GraphQL list helpers ────────────────────────────────────────────────────

/** Default / maximum page size for cursor-paginated GraphQL lists. */
export const PAGE_DEFAULT = 20;
export const PAGE_MAX = 100;

/** Resolve the effective page size from `--first` (default 20, clamped 1..100). */
export function pageSizeFor(flags: ListFlags): number {
  const n = flags.first;
  if (n === undefined || Number.isNaN(n)) return PAGE_DEFAULT;
  return Math.min(Math.max(Math.trunc(n), 1), PAGE_MAX);
}

/** A field's slice of a model's runtime metadata (from `@insurup/sdk` `Query*Meta`). */
interface FieldMeta {
  readonly searchable?: boolean;
  readonly searchOperators?: readonly string[];
}
/** A model's runtime metadata: a map of field name → {@link FieldMeta}. */
export type ListMeta = Readonly<Record<string, FieldMeta>>;

/**
 * Build a server search filter from free-text, OR-ing every searchable field of
 * the model (using `autocomplete` when supported, else `contains`). Each entry
 * carries the `$search: true` marker so the SDK routes it to the search slot.
 * Returns `undefined` when there is no query or the model has no searchable
 * fields. The shape is cast at the call site to the entity's filter type.
 *
 * Search is best-effort per entity: the server honors it for customers,
 * policies, and proposals, but rejects it for some models (e.g. `cases` errors
 * on certain audit fields, `agent-users` rejects the query outright). Those
 * surface as a normal API error rather than being silently dropped.
 */
export function buildSearchFilter(meta: ListMeta, text: string | undefined): unknown {
  const query = text?.trim();
  if (!query) return undefined;
  const clauses = Object.entries(meta)
    .filter(([, m]) => m?.searchable)
    .map(([field, m]) => {
      const op = m.searchOperators?.includes('autocomplete') ? 'autocomplete' : 'contains';
      return { [field]: { $search: true, [op]: query } };
    });
  return clauses.length > 0 ? { or: clauses } : undefined;
}

/** Variables passed to a list fetcher: page size + optional cursor + filter. */
export interface ListPageVars {
  readonly first: number;
  readonly after?: string;
  readonly filter?: unknown;
}

/** Injectable IO for {@link runGraphqlList} (overridden in tests). */
export interface ListDeps {
  readonly confirm: (question: string, opts?: { default?: boolean }) => Promise<boolean>;
  readonly isInteractive: (flags: ListFlags) => boolean;
}

const defaultListDeps: ListDeps = {
  confirm,
  isInteractive: (flags) =>
    !flags.json && !flags.quiet && Boolean(process.stdin.isTTY) && Boolean(process.stdout.isTTY),
};

function renderItems(ctx: LocalContext, flags: ListFlags, items: unknown[]): void {
  if (flags.json) {
    ctx.process.stdout.write(`${formatJson(items)}\n`);
    return;
  }
  const text = formatHuman(items, colorsFor(flags));
  if (text) ctx.process.stdout.write(`${text}\n`);
}

/**
 * Drive a cursor-paginated GraphQL list. `fetchPage` performs one request (the
 * caller wraps `take(client.x.getX(...))`); items, pageInfo and totalCount are
 * extracted generically via {@link asConnection}.
 *
 * - human + interactive (TTY, not `--json`/`--quiet`): render a page, then
 *   prompt "Show more?" and follow the cursor until exhausted or declined.
 * - `--json` / piped / `--quiet`: render a single page; when more exists, the
 *   next cursor is hinted on stderr so stdout stays clean for scripts.
 *
 * Prints its own output and returns nothing (so {@link withClient} won't print).
 */
export async function runGraphqlList(
  scope: ApiScope<ListFlags>,
  meta: ListMeta,
  fetchPage: (vars: ListPageVars) => Promise<unknown>,
  deps: ListDeps = defaultListDeps,
): Promise<void> {
  const { ctx, flags } = scope;
  const first = pageSizeFor(flags);
  const filter = buildSearchFilter(meta, flags.search);
  const interactive = deps.isInteractive(flags);

  let after = flags.after;
  let shown = 0;
  let totalCount: number | undefined;
  let nextCursor: string | undefined;

  for (;;) {
    const result = await fetchPage({
      first,
      ...(after !== undefined ? { after } : {}),
      ...(filter !== undefined ? { filter } : {}),
    });
    const conn = asConnection(result);
    const items = conn?.nodes ?? (Array.isArray(result) ? result : []);
    if (conn?.totalCount != null) totalCount = conn.totalCount;
    shown += items.length;
    renderItems(ctx, flags, items);

    const endCursor = conn?.pageInfo?.endCursor;
    if (!conn?.pageInfo?.hasNextPage || !endCursor) {
      nextCursor = undefined;
      break;
    }
    if (interactive && (await deps.confirm('Show more?', { default: true }))) {
      after = endCursor;
      continue;
    }
    nextCursor = endCursor;
    break;
  }

  if (!flags.quiet) {
    const colors = colorsFor(flags);
    const total = totalCount != null ? ` of ${totalCount}` : '';
    const more = nextCursor ? ` · more: --after ${nextCursor}` : '';
    ctx.process.stderr.write(`${colors.dim(`${shown} item(s)${total}${more}`)}\n`);
  }
}
