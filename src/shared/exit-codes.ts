/**
 * Process exit codes used across the CLI. Stable and documented so scripts can
 * branch on them. `0` is success; everything else is a distinct failure class.
 */
export const EXIT = {
  /** Command succeeded. */
  OK: 0,
  /** Generic / unexpected failure. */
  GENERIC: 1,
  /** Usage or input validation error (bad flags, invalid body). */
  USAGE: 2,
  /** Authentication required or failed. */
  AUTH: 3,
  /** Requested resource was not found. */
  NOT_FOUND: 4,
  /** API or server-side error (including transport failures). */
  API: 5,
} as const;

export type ExitCode = (typeof EXIT)[keyof typeof EXIT];
