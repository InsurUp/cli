import type { CommandContext, StricliProcess } from '@stricli/core';

/**
 * The context handed to every command's `func` as `this`.
 *
 * For now it carries the process streams + environment. Phase 2 extends it with
 * config/profile resolution, the SDK client factory, and the output sink — all
 * built lazily from the per-command flags so global options like `--profile`
 * resolve correctly.
 */
export interface LocalContext extends CommandContext {
  readonly process: StricliProcess;
  readonly env: Readonly<Partial<Record<string, string>>>;
}

/** Build the command context from the host process. */
export function buildContext(proc: NodeJS.Process): LocalContext {
  return {
    process: proc as unknown as StricliProcess,
    env: proc.env,
  };
}
