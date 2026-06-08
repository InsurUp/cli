import { basename } from 'node:path';
import type { PluginHook } from '@insurup/sdk';
import {
  buildCommand,
  buildRouteMap,
  type Command,
  numberParser,
  type TypedCommandParameters,
} from '@stricli/core';
import type { LocalContext } from '../context.ts';
import { printNote, printSuccess, runCommand, take } from '../output/print.ts';
import {
  BUNDLERS,
  type Bundler,
  buildPlugin,
  LANGUAGES,
  type Language,
  PACKAGE_MANAGERS,
  type PackageManager,
} from '../plugin/build.ts';
import { scaffoldPlugin } from '../plugin/scaffold.ts';
import { CliError } from '../shared/errors.ts';
import { EXIT } from '../shared/exit-codes.ts';
import { type GlobalFlags, globalFlags } from '../shared/flags.ts';
import { promptText, select } from '../shared/prompt.ts';
import { cmd0, cmd1 } from './_factory.ts';
import { type DataFlags, dataFlag, readData } from './_shared.ts';

// ── flag parsers / specs / types ────────────────────────────────────────────

function parsePackageManager(value: string): PackageManager {
  if ((PACKAGE_MANAGERS as readonly string[]).includes(value)) return value as PackageManager;
  throw new Error(`Invalid package manager "${value}" (expected: ${PACKAGE_MANAGERS.join(', ')})`);
}

function parseBundler(value: string): Bundler {
  if ((BUNDLERS as readonly string[]).includes(value)) return value as Bundler;
  throw new Error(`Invalid bundler "${value}" (expected: ${BUNDLERS.join(', ')})`);
}

function parseLanguage(value: string): Language {
  if ((LANGUAGES as readonly string[]).includes(value)) return value as Language;
  throw new Error(`Invalid language "${value}" (expected: ${LANGUAGES.join(', ')})`);
}

const pmFlag = {
  packageManager: {
    kind: 'parsed',
    parse: parsePackageManager,
    brief: 'Package manager to run the build script (bun|npm|pnpm|yarn)',
    optional: true,
  },
} as const;
type PmFlags = GlobalFlags & { readonly packageManager?: PackageManager };

const initFlags = {
  ...pmFlag,
  id: {
    kind: 'parsed',
    parse: String,
    brief: 'Plugin id (reverse-DNS, e.g. com.acme.my-plugin)',
    optional: true,
  },
  language: {
    kind: 'parsed',
    parse: parseLanguage,
    brief: 'Authoring language (ts|js)',
    optional: true,
  },
  bundler: {
    kind: 'parsed',
    parse: parseBundler,
    brief: 'Bundler for the build script (bun|esbuild)',
    optional: true,
  },
} as const;
type InitFlags = PmFlags & {
  readonly id?: string;
  readonly language?: Language;
  readonly bundler?: Bundler;
};

const versionFlag = {
  version: { kind: 'parsed', parse: String, brief: 'Semantic version to activate' },
} as const;
type VersionFlags = GlobalFlags & { readonly version: string };

const logsFlags = {
  limit: {
    kind: 'parsed',
    parse: numberParser,
    brief: 'Max entries (default 100)',
    optional: true,
  },
  hook: { kind: 'parsed', parse: String, brief: 'Filter by hook export name', optional: true },
} as const;
type LogsFlags = GlobalFlags & { readonly limit?: number; readonly hook?: string };

const priorityFlag = {
  value: { kind: 'parsed', parse: numberParser, brief: 'Priority value (lower runs first)' },
} as const;
type PriorityFlags = GlobalFlags & { readonly value: number };

const deployFlags = {
  ...pmFlag,
  activate: { kind: 'boolean', brief: 'Activate the uploaded version', default: false },
  config: {
    kind: 'parsed',
    parse: String,
    brief: 'Set config after upload: inline JSON, @file.json, or - for stdin',
    optional: true,
  },
} as const;
type DeployFlags = PmFlags & { readonly activate: boolean; readonly config?: string };

const PM_CHOICES = PACKAGE_MANAGERS.map((value) => ({ value, label: value }));
const BUNDLER_CHOICES = [
  { value: 'bun', label: 'bun (Bun.build)' },
  { value: 'esbuild', label: 'esbuild' },
] as const satisfies ReadonlyArray<{ value: Bundler; label: string }>;
const LANGUAGE_CHOICES = [
  { value: 'ts', label: 'TypeScript' },
  { value: 'js', label: 'JavaScript' },
] as const satisfies ReadonlyArray<{ value: Language; label: string }>;

// ── local helpers ───────────────────────────────────────────────────────────

/** Read + JSON-parse an inline value, `@file`, or `-` (stdin). */
async function readJsonInput(raw: string): Promise<unknown> {
  let text: string;
  if (raw === '-') text = await Bun.stdin.text();
  else if (raw.startsWith('@')) text = await Bun.file(raw.slice(1)).text();
  else text = raw;
  try {
    return JSON.parse(text);
  } catch (err) {
    throw new CliError(`Invalid JSON config: ${(err as Error).message}`, EXIT.USAGE);
  }
}

/** A command that runs locally (no API session / auth) with extra flags + a directory positional. */
function localDirCommand<F extends GlobalFlags>(
  brief: string,
  extraFlags: Record<string, unknown>,
  run: (ctx: LocalContext, flags: F, dir: string) => Promise<void>,
): Command<LocalContext> {
  // The positional spec is assembled then cast once, exactly as in `_factory.ts`.
  const parameters = {
    flags: { ...globalFlags, ...extraFlags },
    positional: {
      kind: 'tuple',
      parameters: [{ brief: 'Plugin directory', parse: String, placeholder: 'dir' }],
    },
  } as unknown as TypedCommandParameters<F, [string], LocalContext>;
  return buildCommand<F, [string], LocalContext>({
    docs: { brief },
    parameters,
    func: function (this: LocalContext, flags: F, dir: string): Promise<void> {
      return runCommand(this, flags, () => run(this, flags, dir));
    },
  });
}

const pmOption = (pm?: PackageManager): { packageManager?: PackageManager } =>
  pm ? { packageManager: pm } : {};

// ── API commands ────────────────────────────────────────────────────────────

const list = cmd0('List installed plugins', {}, ({ client }) => take(client.plugins.getPlugins()));

const get = cmd1('Get a plugin by id', 'Plugin id', {}, ({ client }, id) =>
  take(client.plugins.getPluginById(id)),
);

const logs = cmd1<LogsFlags>(
  'Show a plugin’s invocation logs',
  'Plugin id',
  logsFlags,
  ({ client, flags }, id) =>
    take(
      client.plugins.getPluginLogs(id, {
        ...(flags.limit !== undefined ? { limit: flags.limit } : {}),
        ...(flags.hook !== undefined ? { hook: flags.hook as PluginHook } : {}),
      }),
    ),
);

const activate = cmd1<VersionFlags>(
  'Activate an installed version (also enables the plugin)',
  'Plugin id',
  versionFlag,
  async ({ client, ctx, flags }, id) => {
    await take(client.plugins.activatePlugin(id, { version: flags.version }));
    printSuccess(ctx, flags, `Activated ${id} @ ${flags.version}`);
  },
);

const enable = cmd1('Enable a plugin', 'Plugin id', {}, async ({ client, ctx, flags }, id) => {
  await take(client.plugins.enablePlugin(id));
  printSuccess(ctx, flags, `Enabled ${id}`);
});

const disable = cmd1('Disable a plugin', 'Plugin id', {}, async ({ client, ctx, flags }, id) => {
  await take(client.plugins.disablePlugin(id));
  printSuccess(ctx, flags, `Disabled ${id}`);
});

const remove = cmd1(
  'Remove a plugin and all of its versions (cannot be undone)',
  'Plugin id',
  {},
  async ({ client, ctx, flags }, id) => {
    await take(client.plugins.deletePlugin(id));
    printSuccess(ctx, flags, `Removed ${id}`);
  },
);

const config = cmd1<DataFlags>(
  'Set a plugin’s config (body via --data: inline JSON, @file.json, or - for stdin)',
  'Plugin id',
  dataFlag,
  async ({ client, ctx, flags }, id) => {
    const values = (await readData(flags)) as Record<string, unknown>;
    await take(client.plugins.updatePluginConfig(id, { config: values }));
    printSuccess(ctx, flags, `Updated config for ${id}`);
  },
);

const priority = cmd1<PriorityFlags>(
  'Set a plugin’s ordering priority',
  'Plugin id',
  priorityFlag,
  async ({ client, ctx, flags }, id) => {
    await take(client.plugins.setPluginPriority(id, { priority: flags.value }));
    printSuccess(ctx, flags, `Set priority of ${id} to ${flags.value}`);
  },
);

// ── local commands ──────────────────────────────────────────────────────────

const init = localDirCommand<InitFlags>(
  'Scaffold a new plugin project',
  initFlags,
  async (ctx, flags, dir) => {
    const interactive = Boolean(process.stdin.isTTY) && !flags.json && !flags.quiet;
    const defaultId = `com.example.${basename(dir) || 'my-plugin'}`;
    const id =
      flags.id ??
      (interactive ? await promptText('Plugin id?', { default: defaultId }) : defaultId);
    const language: Language =
      flags.language ??
      (interactive
        ? await select<Language>('Language?', LANGUAGE_CHOICES, { default: 'ts' })
        : 'ts');
    const packageManager: PackageManager =
      flags.packageManager ??
      (interactive
        ? await select<PackageManager>('Package manager?', PM_CHOICES, { default: 'bun' })
        : 'bun');
    const bundler: Bundler =
      flags.bundler ??
      (interactive
        ? await select<Bundler>('Bundler?', BUNDLER_CHOICES, { default: 'bun' })
        : 'bun');

    const written = await scaffoldPlugin(dir, { id, packageManager, bundler, language });
    printNote(
      ctx,
      flags,
      `Scaffolded ${id} in ${dir} (${language} + ${packageManager} + ${bundler}):`,
    );
    for (const path of written) printNote(ctx, flags, `  ${path}`);
    printNote(
      ctx,
      flags,
      `Next: cd ${dir} && ${packageManager} install, then \`insurup plugins deploy ${dir} --activate\`.`,
    );
    printSuccess(ctx, flags, `Created plugin at ${dir}`);
  },
);

const build = localDirCommand<PmFlags>(
  'Bundle a plugin into an uploadable .zip (runs the project’s build script)',
  pmFlag,
  async (ctx, flags, dir) => {
    const { manifest, zip, bundleBytes, packageManager } = await buildPlugin(
      dir,
      pmOption(flags.packageManager),
    );
    const out = `${dir}/dist/${manifest.id}.zip`;
    await Bun.write(out, zip);
    printNote(
      ctx,
      flags,
      `Bundled ${manifest.id}@${manifest.version} via ${packageManager} (${bundleBytes} bytes)`,
    );
    printSuccess(ctx, flags, `Wrote ${out}`);
  },
);

// ── deploy (build + upload + optional activate/config) ──────────────────────

const deploy = cmd1<DeployFlags>(
  'Build a plugin and deploy it (upload, then optionally configure + activate)',
  'Plugin directory',
  deployFlags,
  async ({ client, ctx, flags }, dir) => {
    const { manifest, zip } = await buildPlugin(dir, pmOption(flags.packageManager));
    printNote(ctx, flags, `Uploading ${manifest.id}@${manifest.version}…`);

    const detail = await take(
      client.plugins.uploadPlugin(
        new Blob([zip], { type: 'application/zip' }),
        `${manifest.id}.zip`,
      ),
    );

    // Activate before configuring: config is validated against (and stored on) the
    // active version, so a version must be selected first.
    if (flags.activate) {
      await take(client.plugins.activatePlugin(detail.id, { version: manifest.version }));
      printNote(ctx, flags, `Activated ${manifest.version}.`);
    }

    if (flags.config !== undefined) {
      const values = (await readJsonInput(flags.config)) as Record<string, unknown>;
      await take(client.plugins.updatePluginConfig(detail.id, { config: values }));
      printNote(ctx, flags, 'Config applied.');
    }

    printSuccess(ctx, flags, `Deployed ${manifest.id}@${manifest.version} (${detail.id})`);
    // Re-fetch so the returned detail reflects the post-activate/config state.
    return flags.activate || flags.config !== undefined
      ? await take(client.plugins.getPluginById(detail.id))
      : detail;
  },
);

export const pluginRoutes = buildRouteMap<string, LocalContext>({
  docs: { brief: 'Build, deploy, and manage server-side plugins' },
  routes: {
    init,
    build,
    deploy,
    list,
    get,
    logs,
    activate,
    enable,
    disable,
    remove,
    config,
    priority,
  },
});
