import type { StricliProcess } from '@stricli/core';
import type { LocalContext } from '../../src/context.ts';

// biome-ignore lint/suspicious/noControlCharactersInRegex: stripping ANSI codes
const ANSI = /\[[0-9;]*m/g;

export interface TestContext {
  readonly ctx: LocalContext;
  /** Captured stdout text (ANSI stripped). */
  stdout(): string;
  /** Captured stderr text (ANSI stripped). */
  stderr(): string;
  /** The process exit code set by the command (undefined = unset = success). */
  exitCode(): number | undefined;
}

/** Build a {@link LocalContext} that captures stdout/stderr and exit code. */
export function makeContext(env: Record<string, string> = {}): TestContext {
  let out = '';
  let err = '';
  const proc: StricliProcess = {
    stdout: {
      write: (s: string) => {
        out += s;
      },
    },
    stderr: {
      write: (s: string) => {
        err += s;
      },
    },
    env,
  };
  const ctx: LocalContext = { process: proc, env };
  return {
    ctx,
    stdout: () => out.replace(ANSI, ''),
    stderr: () => err.replace(ANSI, ''),
    exitCode: () => proc.exitCode as number | undefined,
  };
}

/** Strip ANSI color codes from a string. */
export function stripAnsi(s: string): string {
  return s.replace(ANSI, '');
}
