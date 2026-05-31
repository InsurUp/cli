import { homedir } from 'node:os';
import { join } from 'node:path';

type Env = Readonly<Partial<Record<string, string>>>;

/**
 * Resolve the CLI's config directory, honoring XDG on Unix and APPDATA on
 * Windows, falling back to `~/.config/insurup`.
 */
export function configDir(env: Env = process.env): string {
  if (process.platform === 'win32' && env.APPDATA) {
    return join(env.APPDATA, 'insurup');
  }
  const xdg = env.XDG_CONFIG_HOME;
  if (xdg && xdg.length > 0) {
    return join(xdg, 'insurup');
  }
  return join(homedir(), '.config', 'insurup');
}

/** Path to the JSON config file (non-secret settings only). */
export function configFilePath(env: Env = process.env): string {
  return join(configDir(env), 'config.json');
}
