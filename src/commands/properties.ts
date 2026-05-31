import { buildRouteMap } from '@stricli/core';
import type { LocalContext } from '../context.ts';
import { printSuccess } from '../output/print.ts';
import { cmd0, cmd1, cmd2 } from './_factory.ts';
import { type DataFlags, dataFlag, readData, take } from './_shared.ts';

const list = cmd1('List a customer’s properties', 'Customer id', {}, ({ client }, customerId) =>
  take(client.properties.getCustomerProperties(customerId)),
);

const get = cmd2('Get a customer property', 'Customer id', 'Property id', {}, ({ client }, c, p) =>
  take(client.properties.getCustomerPropertyById(c, p)),
);

const create = cmd0<DataFlags>(
  'Create a customer property (body via --data)',
  dataFlag,
  async ({ client, flags }) =>
    take(
      client.properties.createCustomerProperty(
        (await readData(flags)) as Parameters<typeof client.properties.createCustomerProperty>[0],
      ),
    ),
);

const update = cmd0<DataFlags>(
  'Update a customer property (body via --data)',
  dataFlag,
  async ({ client, ctx, flags }) => {
    await take(
      client.properties.updateCustomerProperty(
        (await readData(flags)) as Parameters<typeof client.properties.updateCustomerProperty>[0],
      ),
    );
    printSuccess(ctx, flags, 'Property updated');
  },
);

const del = cmd2(
  'Delete a customer property',
  'Customer id',
  'Property id',
  {},
  async ({ client, ctx, flags }, c, p) => {
    await take(client.properties.deleteCustomerProperty(c, p));
    printSuccess(ctx, flags, `Deleted property ${p}`);
  },
);

const address = cmd1(
  'Resolve an address by property number',
  'Property number',
  {},
  ({ client }, n) => take(client.properties.getPropertyAddressByPropertyNumber(Number(n))),
);

const dask = cmd1(
  'Query a property by DASK old policy number',
  'DASK old policy number',
  {},
  ({ client }, n) => take(client.properties.queryPropertyByDaskOldPolicy(Number(n))),
);

// Address-hierarchy reference data.
const cities = cmd0('List cities', {}, ({ client }) => take(client.properties.queryCities()));
const districts = cmd0<DataFlags>(
  'Query districts (body via --data)',
  dataFlag,
  async ({ client, flags }) =>
    take(
      client.properties.queryDistricts(
        (await readData(flags)) as Parameters<typeof client.properties.queryDistricts>[0],
      ),
    ),
);
const towns = cmd0<DataFlags>(
  'Query towns (body via --data)',
  dataFlag,
  async ({ client, flags }) =>
    take(
      client.properties.queryTowns(
        (await readData(flags)) as Parameters<typeof client.properties.queryTowns>[0],
      ),
    ),
);
const neighborhoods = cmd0<DataFlags>(
  'Query neighborhoods (body via --data)',
  dataFlag,
  async ({ client, flags }) =>
    take(
      client.properties.queryNeighborhoods(
        (await readData(flags)) as Parameters<typeof client.properties.queryNeighborhoods>[0],
      ),
    ),
);
const streets = cmd0<DataFlags>(
  'Query streets (body via --data)',
  dataFlag,
  async ({ client, flags }) =>
    take(
      client.properties.queryStreets(
        (await readData(flags)) as Parameters<typeof client.properties.queryStreets>[0],
      ),
    ),
);

const params = buildRouteMap<string, LocalContext>({
  docs: { brief: 'Address hierarchy reference data' },
  routes: { cities, districts, towns, neighborhoods, streets },
});

export const propertyRoutes = buildRouteMap<string, LocalContext>({
  docs: { brief: 'Manage customer properties and address reference data' },
  routes: { list, get, create, update, delete: del, address, dask, params },
});
