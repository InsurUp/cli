import { join } from 'node:path';
import { zipSync } from 'fflate';
import { CliError } from '../shared/errors.ts';
import { EXIT } from '../shared/exit-codes.ts';

/** Package managers the CLI can drive a plugin project's `build` script with. */
export const PACKAGE_MANAGERS = ['bun', 'npm', 'pnpm', 'yarn'] as const;
export type PackageManager = (typeof PACKAGE_MANAGERS)[number];

/** Bundlers the scaffolder can wire into a plugin's `build` script. */
export const BUNDLERS = ['bun', 'esbuild'] as const;
export type Bundler = (typeof BUNDLERS)[number];

/** Authoring languages the scaffolder supports. */
export const LANGUAGES = ['ts', 'js'] as const;
export type Language = (typeof LANGUAGES)[number];

/** The `plugin.json` manifest shipped at the root of every bundle. */
export interface PluginManifest {
  readonly id: string;
  readonly version: string;
  /** Relative path of the entry module inside the zip (e.g. `index.js`); also `dist/<entry>` on disk. */
  readonly entry: string;
  readonly contractVersion: string;
  readonly runtimeType?: number;
}

/** The result of building a plugin source directory into an uploadable zip. */
export interface BuiltPlugin {
  readonly manifest: PluginManifest;
  readonly zip: Uint8Array;
  readonly bundleBytes: number;
  /** The package manager used to run the project's build script. */
  readonly packageManager: PackageManager;
}

// Globals that throw in the host's sandbox (no Node.js / browser APIs).
const MEMBER_GLOBALS = [
  'window',
  'document',
  'localStorage',
  'sessionStorage',
  'XMLHttpRequest',
  'WebSocket',
  'navigator',
  'indexedDB',
  'process',
  'Buffer',
];
const BARE_GLOBALS = ['__dirname', '__filename'];

/** Lockfile → package manager, for detecting how a project was installed. */
const LOCKFILES: ReadonlyArray<readonly [string, PackageManager]> = [
  ['bun.lock', 'bun'],
  ['bun.lockb', 'bun'],
  ['pnpm-lock.yaml', 'pnpm'],
  ['yarn.lock', 'yarn'],
  ['package-lock.json', 'npm'],
];

/** Blanks out `//`/`/* *​/` comments and `'…'`/`"…"` strings (keeps template literals + code). */
function stripStringsAndComments(code: string): string {
  let out = '';
  let i = 0;
  while (i < code.length) {
    const c = code[i];
    const d = i + 1 < code.length ? code[i + 1] : '';
    if (c === '/' && d === '/') {
      while (i < code.length && code[i] !== '\n') i++;
      continue;
    }
    if (c === '/' && d === '*') {
      i += 2;
      while (i + 1 < code.length && !(code[i] === '*' && code[i + 1] === '/')) i++;
      i += 2;
      continue;
    }
    if (c === '"' || c === "'") {
      const quote = c;
      i++;
      while (i < code.length && code[i] !== quote) {
        if (code[i] === '\\') i++;
        i++;
      }
      i++;
      out += '""';
      continue;
    }
    out += c;
    i++;
  }
  return out;
}

/**
 * Returns the Jint-unsafe APIs a bundle references, or an empty array when it is safe. Mirrors the
 * host's upload-time check: scans code only (strings/comments blanked, `typeof x` guards ignored) and
 * flags real usage — member access, bare Node markers, `require()`, and `node:` imports.
 */
export function scanJintUnsafe(bundle: string): string[] {
  const code = stripStringsAndComments(bundle).replace(/typeof\s+[A-Za-z_$][\w$]*/g, ' ');
  const hits = new Set<string>();
  for (const g of MEMBER_GLOBALS) {
    if (new RegExp(String.raw`(?<![\w.$])${g}\s*[.\[(]`).test(code)) hits.add(g);
  }
  for (const g of BARE_GLOBALS) {
    if (new RegExp(String.raw`(?<![\w.$])${g}(?![\w$])`).test(code)) hits.add(g);
  }
  if (/(?<![\w.$])require\s*\(/.test(code)) hits.add('require()');
  if (/['"]node:[a-z]/.test(bundle)) hits.add('node: import');
  return [...hits].sort();
}

/** Detect the package manager a project was installed with, from its lockfile. */
export async function detectPackageManager(dir: string): Promise<PackageManager | undefined> {
  for (const [file, pm] of LOCKFILES) {
    if (await Bun.file(join(dir, file)).exists()) return pm;
  }
  return undefined;
}

/** Read and validate `plugin.json` from a plugin project directory. */
export async function readManifest(dir: string): Promise<PluginManifest> {
  const file = Bun.file(join(dir, 'plugin.json'));
  if (!(await file.exists())) {
    throw new CliError(`No plugin.json found in ${dir}`, EXIT.USAGE);
  }
  let manifest: PluginManifest;
  try {
    manifest = (await file.json()) as PluginManifest;
  } catch (err) {
    throw new CliError(`Invalid plugin.json: ${(err as Error).message}`, EXIT.USAGE);
  }
  for (const key of ['id', 'version', 'entry', 'contractVersion'] as const) {
    if (typeof manifest[key] !== 'string' || manifest[key].length === 0) {
      throw new CliError(`plugin.json is missing "${key}"`, EXIT.USAGE);
    }
  }
  return manifest;
}

async function hasBuildScript(dir: string): Promise<boolean> {
  const file = Bun.file(join(dir, 'package.json'));
  if (!(await file.exists())) return false;
  try {
    const pkg = (await file.json()) as { scripts?: Record<string, string> };
    return typeof pkg.scripts?.build === 'string';
  } catch {
    return false;
  }
}

/**
 * Builds a plugin into an uploadable `.zip` by running the project's own `build` script (with the
 * chosen / detected package manager), then zipping the manifest + the built entry — so the bundler
 * (bun, esbuild, …) is entirely the plugin project's choice. Fails fast if the build output uses APIs
 * the host sandbox can't provide.
 */
export async function buildPlugin(
  dir: string,
  options: { packageManager?: PackageManager } = {},
): Promise<BuiltPlugin> {
  const manifest = await readManifest(dir);

  if (!(await hasBuildScript(dir))) {
    throw new CliError(
      `No "build" script in ${dir}/package.json. ` +
        `Add one that bundles src/index.ts to dist/${manifest.entry}.`,
      EXIT.USAGE,
    );
  }

  const pm = options.packageManager ?? (await detectPackageManager(dir)) ?? 'bun';

  const proc = Bun.spawn([pm, 'run', 'build'], { cwd: dir, stdout: 'pipe', stderr: 'pipe' });
  const exitCode = await proc.exited;
  if (exitCode !== 0) {
    const stderr = (await new Response(proc.stderr).text()).trim();
    throw new CliError(`\`${pm} run build\` failed${stderr ? `:\n${stderr}` : ''}`, EXIT.GENERIC);
  }

  const builtPath = join(dir, 'dist', manifest.entry);
  const builtFile = Bun.file(builtPath);
  if (!(await builtFile.exists())) {
    throw new CliError(
      `Build did not produce dist/${manifest.entry}. Point your build script's output there.`,
      EXIT.GENERIC,
    );
  }
  const bundle = await builtFile.text();

  const unsafe = scanJintUnsafe(bundle);
  if (unsafe.length > 0) {
    throw new CliError(
      `Plugin uses APIs not available in the sandbox: ${unsafe.join(', ')}. ` +
        'Plugins run on a JS engine with no Node.js or browser globals.',
      EXIT.USAGE,
    );
  }

  const encoder = new TextEncoder();
  const zip = zipSync({
    'plugin.json': encoder.encode(`${JSON.stringify(manifest, null, 2)}\n`),
    [manifest.entry]: encoder.encode(bundle),
  });

  return { manifest, zip, bundleBytes: bundle.length, packageManager: pm };
}
