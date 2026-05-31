import { QueryWebhookDeliveryResultMeta } from '@insurup/sdk';
import { buildRouteMap } from '@stricli/core';
import type { LocalContext } from '../context.ts';
import { printSuccess } from '../output/print.ts';
import { cmd0, cmd1, cmd2 } from './_factory.ts';
import {
  type DataFlags,
  dataFlag,
  type ListFlags,
  listFlags,
  readData,
  runGraphqlList,
  take,
} from './_shared.ts';

const list = cmd0('List webhooks', {}, ({ client }) => take(client.webhooks.getWebhooks()));
const get = cmd1('Get a webhook by id', 'Webhook id', {}, ({ client }, id) =>
  take(client.webhooks.getWebhookById(id)),
);
const create = cmd0<DataFlags>(
  'Create a webhook (body via --data)',
  dataFlag,
  async ({ client, flags }) =>
    take(
      client.webhooks.createWebhook(
        (await readData(flags)) as Parameters<typeof client.webhooks.createWebhook>[0],
      ),
    ),
);
const update = cmd0<DataFlags>(
  'Update a webhook (body via --data)',
  dataFlag,
  async ({ client, ctx, flags }) => {
    await take(
      client.webhooks.updateWebhook(
        (await readData(flags)) as Parameters<typeof client.webhooks.updateWebhook>[0],
      ),
    );
    printSuccess(ctx, flags, 'Webhook updated');
  },
);
const del = cmd1('Delete a webhook by id', 'Webhook id', {}, async ({ client, ctx, flags }, id) => {
  await take(client.webhooks.deleteWebhook(id));
  printSuccess(ctx, flags, `Deleted webhook ${id}`);
});

const deliveryGet = cmd2(
  'Get a webhook delivery',
  'Webhook id',
  'Delivery id',
  {},
  ({ client }, w, d) => take(client.webhooks.getWebhookDelivery(w, d)),
);
const deliveryRedeliver = cmd2(
  'Redeliver a webhook event',
  'Webhook id',
  'Delivery id',
  {},
  async ({ client, ctx, flags }, w, d) => {
    await take(client.webhooks.redeliverWebhookEvent(w, d));
    printSuccess(ctx, flags, 'Redelivery requested');
  },
);
const deliveryList = cmd0<ListFlags>(
  'List webhook deliveries (GraphQL, cursor-paginated)',
  listFlags,
  (scope) =>
    runGraphqlList(scope, QueryWebhookDeliveryResultMeta, (vars) =>
      take(
        scope.client.webhooks.getWebhookDeliveries(
          vars as Parameters<typeof scope.client.webhooks.getWebhookDeliveries>[0],
        ),
      ),
    ),
);
const deliveries = buildRouteMap<string, LocalContext>({
  docs: { brief: 'Webhook deliveries' },
  routes: { list: deliveryList, get: deliveryGet, redeliver: deliveryRedeliver },
});

export const webhookRoutes = buildRouteMap<string, LocalContext>({
  docs: { brief: 'Manage webhooks and deliveries' },
  routes: { list, get, create, update, delete: del, deliveries },
});
