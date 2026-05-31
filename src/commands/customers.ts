import { buildRouteMap } from '@stricli/core';
import type { LocalContext } from '../context.ts';
import { printSuccess } from '../output/print.ts';
import { cmd0, cmd1 } from './_factory.ts';
import { type DataFlags, dataFlag, type PageFlags, pageFlags, readData, take } from './_shared.ts';

const list = cmd0<PageFlags>(
  'List customers (GraphQL, cursor-paginated)',
  pageFlags,
  ({ client, flags }) =>
    take(
      client.customers.getCustomers({
        ...(flags.first !== undefined ? { first: flags.first } : {}),
        ...(flags.after !== undefined ? { after: flags.after } : {}),
      }),
    ),
);

const get = cmd1('Get a customer by id', 'Customer id', {}, ({ client }, id) =>
  take(client.customers.getCustomer(id)),
);

const me = cmd0('Get the currently authenticated customer', {}, ({ client }) =>
  take(client.customers.getCurrentCustomer()),
);

const create = cmd0<DataFlags>(
  'Create a customer (body via --data)',
  dataFlag,
  async ({ client, flags }) => {
    const body = (await readData(flags)) as Parameters<typeof client.customers.createCustomer>[0];
    return take(client.customers.createCustomer(body));
  },
);

const update = cmd1<DataFlags>(
  'Update a customer (id + body via --data)',
  'Customer id',
  dataFlag,
  async ({ client, ctx, flags }, id) => {
    const body = { ...((await readData(flags)) as object), id } as Parameters<
      typeof client.customers.updateCustomer
    >[0];
    await take(client.customers.updateCustomer(body));
    printSuccess(ctx, flags, `Updated customer ${id}`);
  },
);

const del = cmd1(
  'Delete a customer by id',
  'Customer id',
  {},
  async ({ client, ctx, flags }, id) => {
    await take(client.customers.deleteCustomer(id));
    printSuccess(ctx, flags, `Deleted customer ${id}`);
  },
);

export const customerRoutes = buildRouteMap<string, LocalContext>({
  docs: { brief: 'Manage customers' },
  routes: { list, get, me, create, update, delete: del },
});
