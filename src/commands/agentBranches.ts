import { buildRouteMap } from '@stricli/core';
import type { LocalContext } from '../context.ts';
import { printSuccess } from '../output/print.ts';
import { cmd0, cmd1 } from './_factory.ts';
import { type DataFlags, dataFlag, readData, take } from './_shared.ts';

const list = cmd0('List agent branches', {}, ({ client }) =>
  take(client.agentBranches.getAgentBranches()),
);
const get = cmd1('Get an agent branch by id', 'Branch id', {}, ({ client }, id) =>
  take(client.agentBranches.getAgentBranchById(id)),
);
const create = cmd0<DataFlags>(
  'Create an agent branch (body via --data)',
  dataFlag,
  async ({ client, flags }) =>
    take(
      client.agentBranches.createAgentBranch(
        (await readData(flags)) as Parameters<typeof client.agentBranches.createAgentBranch>[0],
      ),
    ),
);
const update = cmd0<DataFlags>(
  'Update an agent branch (body via --data)',
  dataFlag,
  async ({ client, ctx, flags }) => {
    await take(
      client.agentBranches.updateAgentBranch(
        (await readData(flags)) as Parameters<typeof client.agentBranches.updateAgentBranch>[0],
      ),
    );
    printSuccess(ctx, flags, 'Agent branch updated');
  },
);
const del = cmd1(
  'Delete an agent branch by id',
  'Branch id',
  {},
  async ({ client, ctx, flags }, id) => {
    await take(client.agentBranches.deleteAgentBranch({ id }));
    printSuccess(ctx, flags, `Deleted agent branch ${id}`);
  },
);

export const agentBranchRoutes = buildRouteMap<string, LocalContext>({
  docs: { brief: 'Manage agent branches' },
  routes: { list, get, create, update, delete: del },
});
