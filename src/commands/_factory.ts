import { buildCommand, type Command, type TypedCommandParameters } from '@stricli/core';
import type { LocalContext } from '../context.ts';
import { type GlobalFlags, globalFlags } from '../shared/flags.ts';
import { type ApiScope, withClient } from './_shared.ts';

/**
 * Command factories. They merge the shared {@link globalFlags} with any extra
 * flag specs and wrap the handler in {@link withClient} (auth + uniform errors +
 * auto-print). The handler returns data to print, or `undefined` after printing
 * its own success. `F` keeps `scope.flags` fully typed for the handler; the flag
 * *spec* object is cast once (it is assembled from `satisfies`-checked pieces).
 */

type ExtraFlags = Record<string, unknown>;

function paramsFor<F extends GlobalFlags, A extends readonly unknown[]>(
  extraFlags: ExtraFlags,
  positional?: unknown,
): TypedCommandParameters<F, A, LocalContext> {
  const flags = { ...globalFlags, ...extraFlags };
  return (positional ? { flags, positional } : { flags }) as unknown as TypedCommandParameters<
    F,
    A,
    LocalContext
  >;
}

function tuple(...briefs: string[]): unknown {
  return {
    kind: 'tuple',
    parameters: briefs.map((brief) => ({ brief, parse: String, placeholder: 'id' })),
  };
}

/** Command with no positional arguments. */
export function cmd0<F extends GlobalFlags = GlobalFlags>(
  brief: string,
  extraFlags: ExtraFlags,
  run: (scope: ApiScope<F>) => unknown | Promise<unknown>,
): Command<LocalContext> {
  return buildCommand<F, [], LocalContext>({
    docs: { brief },
    parameters: paramsFor<F, []>(extraFlags),
    func: function (this: LocalContext, flags: F): Promise<void> {
      return withClient(this, flags, run);
    },
  });
}

/** Command with one positional argument (e.g. an id). */
export function cmd1<F extends GlobalFlags = GlobalFlags>(
  brief: string,
  argBrief: string,
  extraFlags: ExtraFlags,
  run: (scope: ApiScope<F>, arg: string) => unknown | Promise<unknown>,
): Command<LocalContext> {
  return buildCommand<F, [string], LocalContext>({
    docs: { brief },
    parameters: paramsFor<F, [string]>(extraFlags, tuple(argBrief)),
    func: function (this: LocalContext, flags: F, arg: string): Promise<void> {
      return withClient(this, flags, (scope) => run(scope, arg));
    },
  });
}

/** Command with two positional arguments (e.g. customerId + childId). */
export function cmd2<F extends GlobalFlags = GlobalFlags>(
  brief: string,
  arg1Brief: string,
  arg2Brief: string,
  extraFlags: ExtraFlags,
  run: (scope: ApiScope<F>, arg1: string, arg2: string) => unknown | Promise<unknown>,
): Command<LocalContext> {
  return buildCommand<F, [string, string], LocalContext>({
    docs: { brief },
    parameters: paramsFor<F, [string, string]>(extraFlags, tuple(arg1Brief, arg2Brief)),
    func: function (this: LocalContext, flags: F, arg1: string, arg2: string): Promise<void> {
      return withClient(this, flags, (scope) => run(scope, arg1, arg2));
    },
  });
}
