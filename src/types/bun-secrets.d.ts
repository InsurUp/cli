/**
 * Ambient typings for `Bun.secrets` (OS keychain) — present at runtime in Bun >= 1.2
 * but not yet shipped in the installed `@types/bun`. Backed by macOS Keychain,
 * libsecret (Linux), and Windows Credential Manager.
 */
declare module 'bun' {
  interface SecretsGetOptions {
    readonly service: string;
    readonly name: string;
  }
  interface SecretsSetOptions extends SecretsGetOptions {
    readonly value: string;
  }
  const secrets: {
    get(options: SecretsGetOptions): Promise<string | null>;
    set(options: SecretsSetOptions): Promise<void>;
    delete(options: SecretsGetOptions): Promise<boolean | undefined>;
  };
}
