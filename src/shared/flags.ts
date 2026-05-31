import { type FlagParametersForType, numberParser } from '@stricli/core';
import type { LocalContext } from '../context.ts';

/**
 * Flags available on (almost) every command. They control output shape and let
 * any config value be overridden per-invocation — important for automation,
 * where flags beat env beat config-file beat defaults.
 */
// A `type` alias (not `interface`) so it is assignable to the SDK/stricli
// `BaseFlags` (`Record<string, unknown>`) constraint used by the command factory.
export type GlobalFlags = {
  /** Emit machine-readable JSON instead of human output. */
  readonly json: boolean;
  /** Suppress non-essential human output (chrome, hints, progress). */
  readonly quiet: boolean;
  /** Colorize output. `--no-color` (or NO_COLOR / non-TTY) disables it. */
  readonly color: boolean;
  /** Print diagnostic detail to stderr. */
  readonly verbose: boolean;
  /** Config profile to use (defaults to env INSURUP_PROFILE or "default"). */
  readonly profile?: string;
  /** OAuth client id override. */
  readonly clientId?: string;
  /** Authorization server URL override. */
  readonly authServer?: string;
  /** API base URL override. */
  readonly baseUrl?: string;
  /** Per-request timeout in milliseconds. */
  readonly timeout?: number;
};

/**
 * The flag definitions for {@link GlobalFlags}. Spread into each command's
 * `flags` object; with `caseStyle: "allow-kebab-for-camel"` the camelCase keys
 * are entered as `--client-id`, `--auth-server`, `--base-url`, etc.
 */
export const globalFlags = {
  json: { kind: 'boolean', brief: 'Output machine-readable JSON', default: false },
  quiet: { kind: 'boolean', brief: 'Suppress non-essential output', default: false },
  color: { kind: 'boolean', brief: 'Colorize output (use --no-color to disable)', default: true },
  verbose: { kind: 'boolean', brief: 'Print diagnostic detail to stderr', default: false },
  profile: { kind: 'parsed', parse: String, brief: 'Config profile name', optional: true },
  clientId: { kind: 'parsed', parse: String, brief: 'OAuth client id (override)', optional: true },
  authServer: {
    kind: 'parsed',
    parse: String,
    brief: 'Authorization server URL (override)',
    optional: true,
  },
  baseUrl: { kind: 'parsed', parse: String, brief: 'API base URL (override)', optional: true },
  timeout: {
    kind: 'parsed',
    parse: numberParser,
    brief: 'Request timeout in ms (override)',
    optional: true,
  },
} satisfies FlagParametersForType<GlobalFlags, LocalContext>;
