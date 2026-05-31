import { buildRouteMap } from '@stricli/core';
import type { LocalContext } from '../context.ts';
import { printSuccess } from '../output/print.ts';
import { cmd0, cmd1 } from './_factory.ts';
import { type DataFlags, dataFlag, readData, take } from './_shared.ts';

const list = cmd0('List OAuth clients', {}, ({ client }) =>
  take(client.oauthClients.getOAuthClients()),
);
const get = cmd1('Get an OAuth client by id', 'Client id', {}, ({ client }, id) =>
  take(client.oauthClients.getOAuthClientById(id)),
);
const create = cmd0<DataFlags>(
  'Create an OAuth client (body via --data)',
  dataFlag,
  async ({ client, flags }) =>
    take(
      client.oauthClients.createOAuthClient(
        (await readData(flags)) as Parameters<typeof client.oauthClients.createOAuthClient>[0],
      ),
    ),
);
const update = cmd0<DataFlags>(
  'Update an OAuth client (body via --data)',
  dataFlag,
  async ({ client, ctx, flags }) => {
    await take(
      client.oauthClients.updateOAuthClient(
        (await readData(flags)) as Parameters<typeof client.oauthClients.updateOAuthClient>[0],
      ),
    );
    printSuccess(ctx, flags, 'OAuth client updated');
  },
);
const del = cmd1(
  'Delete an OAuth client by id',
  'Client id',
  {},
  async ({ client, ctx, flags }, id) => {
    await take(client.oauthClients.deleteOAuthClient(id));
    printSuccess(ctx, flags, `Deleted OAuth client ${id}`);
  },
);

export const oauthClientRoutes = buildRouteMap<string, LocalContext>({
  docs: { brief: 'Manage OAuth client registrations' },
  routes: { list, get, create, update, delete: del },
});
