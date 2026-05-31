import { buildRouteMap } from '@stricli/core';
import type { LocalContext } from '../context.ts';
import { printSuccess } from '../output/print.ts';
import { cmd0, cmd2 } from './_factory.ts';
import { type DataFlags, dataFlag, readData, take } from './_shared.ts';

const list = cmd0('List templates', {}, ({ client }) => take(client.templates.getAllTemplates()));
const definitions = cmd0('List template definitions', {}, ({ client }) =>
  take(client.templates.getTemplateDefinitions()),
);
const get = cmd2(
  'Get a template by key + language',
  'Template key',
  'Language id',
  {},
  ({ client }, key, lang) => take(client.templates.getTemplateByKey(key, Number(lang))),
);
const update = cmd0<DataFlags>(
  'Update a template (body via --data)',
  dataFlag,
  async ({ client, ctx, flags }) => {
    await take(
      client.templates.updateTemplate(
        (await readData(flags)) as Parameters<typeof client.templates.updateTemplate>[0],
      ),
    );
    printSuccess(ctx, flags, 'Template updated');
  },
);
const del = cmd2(
  'Delete a template by key + language',
  'Template key',
  'Language id',
  {},
  async ({ client, ctx, flags }, key, lang) => {
    await take(client.templates.deleteTemplate({ key, languageId: Number(lang) }));
    printSuccess(ctx, flags, `Deleted template ${key}`);
  },
);

export const templateRoutes = buildRouteMap<string, LocalContext>({
  docs: { brief: 'Manage document/email templates' },
  routes: { list, definitions, get, update, delete: del },
});
