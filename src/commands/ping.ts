import { buildCommand } from '@stricli/core';
import type { LocalContext } from '../context.ts';

interface PingFlags {
  readonly json: boolean;
}

/**
 * Trivial liveness command used to smoke-test routing and the compiled binary.
 * Real module commands replace this as the source of truth in later phases.
 */
export const pingCommand = buildCommand<PingFlags, [], LocalContext>({
  docs: { brief: 'Print "pong" — smoke test that the CLI is wired up' },
  parameters: {
    flags: {
      json: { kind: 'boolean', brief: 'Emit JSON', default: false },
    },
  },
  func: function (this: LocalContext, flags: PingFlags): void {
    const out = flags.json ? `${JSON.stringify({ ok: true, message: 'pong' })}\n` : 'pong\n';
    this.process.stdout.write(out);
  },
});
