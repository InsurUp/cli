import { describe, expect, test } from 'bun:test';
import type { ApiScope } from '../../src/commands/_shared.ts';
import {
  buildSearchFilter,
  type ListDeps,
  type ListFlags,
  type ListMeta,
  type ListPageVars,
  pageSizeFor,
  runGraphqlList,
} from '../../src/commands/_shared.ts';
import { makeContext } from '../helpers/context.ts';

const baseFlags: ListFlags = { json: false, quiet: false, color: false, verbose: false };

const meta: ListMeta = {
  id: { searchable: false },
  name: { searchable: true, searchOperators: ['contains', 'autocomplete'] },
  email: { searchable: true, searchOperators: ['contains', 'autocomplete'] },
  createdAt: { searchable: true, searchOperators: ['contains'] }, // no autocomplete → contains
};

describe('pageSizeFor', () => {
  test('defaults to 20', () => expect(pageSizeFor(baseFlags)).toBe(20));
  test('clamps above the 100 max', () =>
    expect(pageSizeFor({ ...baseFlags, first: 500 })).toBe(100));
  test('clamps below 1', () => expect(pageSizeFor({ ...baseFlags, first: 0 })).toBe(1));
  test('truncates fractional sizes', () =>
    expect(pageSizeFor({ ...baseFlags, first: 33.9 })).toBe(33));
  test('NaN falls back to the default', () =>
    expect(pageSizeFor({ ...baseFlags, first: Number.NaN })).toBe(20));
});

describe('buildSearchFilter', () => {
  test('is undefined without a query', () =>
    expect(buildSearchFilter(meta, undefined)).toBeUndefined());
  test('is undefined for a blank query', () =>
    expect(buildSearchFilter(meta, '   ')).toBeUndefined());

  test('ORs searchable fields with the $search marker', () => {
    const filter = buildSearchFilter(meta, 'ada') as { or: Array<Record<string, unknown>> };
    expect(filter.or).toHaveLength(3); // name, email, createdAt (not id)
    expect(filter.or).toContainEqual({ name: { $search: true, autocomplete: 'ada' } });
    expect(filter.or).toContainEqual({ email: { $search: true, autocomplete: 'ada' } });
    // a searchable field without `autocomplete` falls back to `contains`
    expect(filter.or).toContainEqual({ createdAt: { $search: true, contains: 'ada' } });
  });

  test('is undefined when the model has no searchable fields', () => {
    expect(buildSearchFilter({ id: { searchable: false } }, 'x')).toBeUndefined();
  });
});

function connection(
  nodes: unknown[],
  hasNextPage: boolean,
  endCursor: string | null,
  totalCount: number,
): unknown {
  return { nodes, pageInfo: { hasNextPage, endCursor }, totalCount };
}

function scopeFor(flags: ListFlags) {
  const t = makeContext();
  const scope = { client: {}, ctx: t.ctx, flags } as unknown as ApiScope<ListFlags>;
  return { t, scope };
}

const nonInteractive: ListDeps = { confirm: async () => false, isInteractive: () => false };

describe('runGraphqlList', () => {
  test('json single page prints the items array and a stderr footer', async () => {
    const { t, scope } = scopeFor({ ...baseFlags, json: true });
    await runGraphqlList(
      scope,
      meta,
      async () => connection([{ id: 1 }, { id: 2 }], false, null, 2),
      nonInteractive,
    );
    expect(JSON.parse(t.stdout())).toEqual([{ id: 1 }, { id: 2 }]);
    expect(t.stderr()).toContain('2 item(s) of 2');
    expect(t.stderr()).not.toContain('--after');
  });

  test('non-interactive with more pages hints the next cursor on stderr', async () => {
    const { t, scope } = scopeFor({ ...baseFlags, json: true });
    await runGraphqlList(
      scope,
      meta,
      async () => connection([{ id: 1 }], true, 'CUR', 10),
      nonInteractive,
    );
    expect(t.stderr()).toContain('more: --after CUR');
  });

  test('interactive follows the cursor until the user declines', async () => {
    const seen: Array<string | undefined> = [];
    let calls = 0;
    const interactive: ListDeps = {
      confirm: async () => calls++ === 0, // yes once, then no
      isInteractive: () => true,
    };
    const { t, scope } = scopeFor(baseFlags);
    await runGraphqlList(
      scope,
      meta,
      async (vars: ListPageVars) => {
        seen.push(vars.after);
        return connection([{ id: seen.length }], true, `cur-${seen.length}`, 9);
      },
      interactive,
    );
    expect(seen).toEqual([undefined, 'cur-1']); // page 1, then page 2 after the first cursor
    expect(t.stdout()).toContain('id: 1');
    expect(t.stdout()).toContain('id: 2');
  });

  test('forwards page size and --search into the fetcher', async () => {
    let received: ListPageVars | undefined;
    const { scope } = scopeFor({ ...baseFlags, json: true, search: 'ada', first: 50 });
    await runGraphqlList(
      scope,
      meta,
      async (vars: ListPageVars) => {
        received = vars;
        return connection([], false, null, 0);
      },
      nonInteractive,
    );
    expect(received?.first).toBe(50);
    expect(received?.filter).toBeDefined();
  });

  test('renders an empty page as a no-results hint', async () => {
    const { t, scope } = scopeFor(baseFlags);
    await runGraphqlList(scope, meta, async () => connection([], false, null, 0), nonInteractive);
    expect(t.stdout()).toContain('(no results)');
  });
});
