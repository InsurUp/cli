import { buildRouteMap } from '@stricli/core';
import type { LocalContext } from '../context.ts';
import { printSuccess } from '../output/print.ts';
import { cmd0, cmd1, cmd2 } from './_factory.ts';
import { type DataFlags, dataFlag, readData, take } from './_shared.ts';

const list = cmd1('List a customer’s vehicles', 'Customer id', {}, ({ client }, customerId) =>
  take(client.vehicles.getCustomerVehicles({ customerId })),
);

const get = cmd2('Get a customer vehicle', 'Customer id', 'Vehicle id', {}, ({ client }, c, v) =>
  take(client.vehicles.getCustomerVehicle(c, v)),
);

const add = cmd0<DataFlags>(
  'Add a vehicle to a customer (body via --data)',
  dataFlag,
  async ({ client, flags }) =>
    take(
      client.vehicles.addCustomerVehicle(
        (await readData(flags)) as Parameters<typeof client.vehicles.addCustomerVehicle>[0],
      ),
    ),
);

const update = cmd0<DataFlags>(
  'Update a customer vehicle (body via --data)',
  dataFlag,
  async ({ client, ctx, flags }) => {
    await take(
      client.vehicles.updateCustomerVehicle(
        (await readData(flags)) as Parameters<typeof client.vehicles.updateCustomerVehicle>[0],
      ),
    );
    printSuccess(ctx, flags, 'Vehicle updated');
  },
);

const del = cmd2(
  'Delete a customer vehicle',
  'Customer id',
  'Vehicle id',
  {},
  async ({ client, ctx, flags }, c, v) => {
    await take(client.vehicles.deleteCustomerVehicle(c, v));
    printSuccess(ctx, flags, `Deleted vehicle ${v}`);
  },
);

const lookup = cmd0<DataFlags>(
  'External vehicle lookup (body via --data)',
  dataFlag,
  async ({ client, flags }) =>
    take(
      client.vehicles.externalLookupVehicle(
        (await readData(flags)) as Parameters<typeof client.vehicles.externalLookupVehicle>[0],
      ),
    ),
);

const brands = cmd0('List vehicle brands', {}, ({ client }) =>
  take(client.vehicles.queryVehicleBrands()),
);

const models = cmd0<DataFlags>(
  'Query vehicle models ({ brandReference, year } via --data)',
  dataFlag,
  async ({ client, flags }) =>
    take(
      client.vehicles.queryVehicleModels(
        (await readData(flags)) as Parameters<typeof client.vehicles.queryVehicleModels>[0],
      ),
    ),
);

const byBrandCode = cmd1('Query a vehicle by brand code', 'Brand code', {}, ({ client }, code) =>
  take(client.vehicles.queryVehicleByBrandCode(code)),
);

export const vehicleRoutes = buildRouteMap<string, LocalContext>({
  docs: { brief: 'Manage customer vehicles and vehicle reference data' },
  routes: {
    list,
    get,
    add,
    update,
    delete: del,
    lookup,
    brands,
    models,
    'by-brand-code': byBrandCode,
  },
});
