import pc from 'picocolors';
import type { GlobalFlags } from '../shared/flags.ts';

export type Colors = ReturnType<typeof pc.createColors>;

/**
 * Build a color palette honoring `--no-color`, the `NO_COLOR` env var, and
 * non-TTY output (picocolors auto-detects the latter two via `isColorSupported`).
 */
export function colorsFor(flags: Pick<GlobalFlags, 'color'>): Colors {
  return pc.createColors(flags.color !== false && pc.isColorSupported);
}
