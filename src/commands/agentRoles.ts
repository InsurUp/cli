import { buildRouteMap } from '@stricli/core';
import type { LocalContext } from '../context.ts';
import { printSuccess } from '../output/print.ts';
import { cmd0, cmd1 } from './_factory.ts';
import { type DataFlags, dataFlag, readData, take } from './_shared.ts';

const list = cmd0('List agent roles', {}, ({ client }) => take(client.agentRoles.getAgentRoles()));
const get = cmd1('Get an agent role by id', 'Role id', {}, ({ client }, id) =>
  take(client.agentRoles.getAgentRoleById(id)),
);
const create = cmd0<DataFlags>(
  'Create an agent role (body via --data)',
  dataFlag,
  async ({ client, flags }) =>
    take(
      client.agentRoles.createAgentRole(
        (await readData(flags)) as Parameters<typeof client.agentRoles.createAgentRole>[0],
      ),
    ),
);
const update = cmd0<DataFlags>(
  'Update an agent role (body via --data)',
  dataFlag,
  async ({ client, ctx, flags }) => {
    await take(
      client.agentRoles.updateAgentRole(
        (await readData(flags)) as Parameters<typeof client.agentRoles.updateAgentRole>[0],
      ),
    );
    printSuccess(ctx, flags, 'Agent role updated');
  },
);
const del = cmd1(
  'Delete an agent role by id',
  'Role id',
  {},
  async ({ client, ctx, flags }, id) => {
    await take(client.agentRoles.deleteAgentRole({ id }));
    printSuccess(ctx, flags, `Deleted agent role ${id}`);
  },
);

export const agentRoleRoutes = buildRouteMap<string, LocalContext>({
  docs: { brief: 'Manage agent roles (RBAC)' },
  routes: { list, get, create, update, delete: del },
});
