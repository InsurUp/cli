import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { CliError } from '../shared/errors.ts';
import { EXIT } from '../shared/exit-codes.ts';
import type { Bundler, Language, PackageManager } from './build.ts';

/** A file the scaffold writes, relative to the plugin directory. */
interface ScaffoldFile {
  readonly path: string;
  readonly contents: string;
}

/** Options that shape the scaffolded project. */
export interface ScaffoldOptions {
  readonly id: string;
  readonly packageManager: PackageManager;
  readonly bundler: Bundler;
  readonly language: Language;
}

function manifestJson(id: string): string {
  return `${JSON.stringify(
    { id, version: '1.0.0', entry: 'index.js', contractVersion: '1' },
    null,
    2,
  )}\n`;
}

/** The `build` script for the chosen bundler + language; both output to dist/index.js (the manifest entry). */
function buildScript(bundler: Bundler, language: Language): string {
  const entry = `src/index.${language}`;
  return bundler === 'esbuild'
    ? `esbuild ${entry} --bundle --format=esm --platform=browser --target=es2020 --outfile=dist/index.js`
    : `bun build ${entry} --target=browser --format=esm --outfile=dist/index.js`;
}

function devDependencies(bundler: Bundler, language: Language): Record<string, string> {
  const deps: Record<string, string> = {};
  if (language === 'ts') {
    deps.typescript = '^5';
    deps['@types/bun'] = 'latest';
  }
  if (bundler === 'esbuild') {
    deps.esbuild = '^0.24.0';
  }
  return deps;
}

function packageJson(name: string, bundler: Bundler, language: Language): string {
  return `${JSON.stringify(
    {
      name,
      version: '1.0.0',
      private: true,
      type: 'module',
      scripts: { build: buildScript(bundler, language) },
      dependencies: { '@insurup/plugin': '^0.1.0' },
      devDependencies: devDependencies(bundler, language),
    },
    null,
    2,
  )}\n`;
}

const TSCONFIG = `${JSON.stringify(
  {
    compilerOptions: {
      lib: ['ES2020'],
      target: 'ES2020',
      module: 'ESNext',
      moduleResolution: 'bundler',
      types: ['@insurup/plugin/globals'],
      strict: true,
      noEmit: true,
      skipLibCheck: true,
    },
    include: ['src'],
  },
  null,
  2,
)}\n`;

const INDEX_TS = `import { defineConfig, type EventHook, type Infer } from '@insurup/plugin';

export const configSchema = defineConfig((c) => ({
  greeting: c.string().default('Hello'),
}));

type Config = Infer<typeof configSchema>;

export const onCustomerUpdated: EventHook<'onCustomerUpdated', Config> = async (ctx, event) => {
  const customer = await ctx.data.getCustomerById(event.customerId);
  ctx.log.info(\`\${ctx.config.greeting} from the plugin\`, {
    customerId: event.customerId,
    name: customer?.name ?? null,
  });
};
`;

const INDEX_JS = `import { defineConfig } from '@insurup/plugin';

export const configSchema = defineConfig((c) => ({
  greeting: c.string().default('Hello'),
}));

/** @type {import('@insurup/plugin').EventHook<'onCustomerUpdated'>} */
export const onCustomerUpdated = async (ctx, event) => {
  const customer = await ctx.data.getCustomerById(event.customerId);
  ctx.log.info(\`\${ctx.config.greeting} from the plugin\`, {
    customerId: event.customerId,
    name: customer?.name ?? null,
  });
};
`;

const GITIGNORE = 'node_modules/\ndist/\n*.zip\n';

/**
 * Scaffolds a new plugin project at `dir` for the chosen id, package manager, bundler, and language.
 * Returns the files written. Throws if `plugin.json` already exists (so an existing project is never
 * clobbered).
 */
export async function scaffoldPlugin(dir: string, options: ScaffoldOptions): Promise<string[]> {
  if (await Bun.file(join(dir, 'plugin.json')).exists()) {
    throw new CliError(`A plugin already exists at ${dir} (plugin.json present)`, EXIT.USAGE);
  }

  const name = options.id.split('.').pop() || 'my-plugin';
  const files: ScaffoldFile[] = [
    { path: 'plugin.json', contents: manifestJson(options.id) },
    { path: 'package.json', contents: packageJson(name, options.bundler, options.language) },
    { path: '.gitignore', contents: GITIGNORE },
    {
      path: `src/index.${options.language}`,
      contents: options.language === 'ts' ? INDEX_TS : INDEX_JS,
    },
  ];
  if (options.language === 'ts') {
    files.push({ path: 'tsconfig.json', contents: TSCONFIG });
  }

  await mkdir(join(dir, 'src'), { recursive: true });
  for (const file of files) {
    await Bun.write(join(dir, file.path), file.contents);
  }
  return files.map((f) => f.path);
}
