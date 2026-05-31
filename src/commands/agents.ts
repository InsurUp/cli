import { buildRouteMap } from '@stricli/core';
import type { LocalContext } from '../context.ts';
import { printSuccess } from '../output/print.ts';
import { cmd0, cmd1 } from './_factory.ts';
import { type DataFlags, dataFlag, readData, take } from './_shared.ts';

const me = cmd0('Get the current agent', {}, ({ client }) => take(client.agents.getCurrentAgent()));

const update = cmd0<DataFlags>(
  'Update the current agent (body via --data)',
  dataFlag,
  async ({ client, ctx, flags }) => {
    await take(
      client.agents.updateCurrentAgent(
        (await readData(flags)) as Parameters<typeof client.agents.updateCurrentAgent>[0],
      ),
    );
    printSuccess(ctx, flags, 'Agent updated');
  },
);

// Insurance-company connections
const icList = cmd0('List the agent’s insurance companies', {}, ({ client }) =>
  take(client.agents.getAgentInsuranceCompaniesAsync()),
);
const icAdd = cmd0<DataFlags>(
  'Add an insurance company to the agent (body via --data)',
  dataFlag,
  async ({ client, flags }) =>
    take(
      client.agents.addAgentInsuranceCompany(
        (await readData(flags)) as Parameters<typeof client.agents.addAgentInsuranceCompany>[0],
      ),
    ),
);
const icRemove = cmd1(
  'Remove an agent insurance company',
  'Agent insurance company id',
  {},
  async ({ client, ctx, flags }, id) => {
    await take(client.agents.removeAgentInsuranceCompany(id));
    printSuccess(ctx, flags, 'Insurance company removed');
  },
);
const icBranches = cmd1(
  'List branches for an agent insurance company',
  'Agent insurance company id',
  {},
  ({ client }, id) => take(client.agents.getAgentInsuranceCompanyBranchesAsync(id)),
);
const icConnection = cmd1(
  'Get connection details for an agent insurance company',
  'Agent insurance company id',
  {},
  ({ client }, id) => take(client.agents.getAgentInsuranceCompanyConnectionAsync(id)),
);
const icUpdateConnection = cmd0<DataFlags>(
  'Update an agent insurance company connection (body via --data)',
  dataFlag,
  async ({ client, ctx, flags }) => {
    await take(
      client.agents.updateAgentInsuranceCompanyConnection(
        (await readData(flags)) as Parameters<
          typeof client.agents.updateAgentInsuranceCompanyConnection
        >[0],
      ),
    );
    printSuccess(ctx, flags, 'Connection updated');
  },
);
const icUpdateBranches = cmd0<DataFlags>(
  'Update agent insurance company branches (body via --data)',
  dataFlag,
  async ({ client, ctx, flags }) => {
    await take(
      client.agents.updateAgentInsuranceCompanyBranches(
        (await readData(flags)) as Parameters<
          typeof client.agents.updateAgentInsuranceCompanyBranches
        >[0],
      ),
    );
    printSuccess(ctx, flags, 'Branches updated');
  },
);
const icResync = cmd0<DataFlags>(
  'Re-sync an agent insurance company (body via --data)',
  dataFlag,
  async ({ client, ctx, flags }) => {
    await take(
      client.agents.reSyncAgentInsuranceCompanyWithInsurance(
        (await readData(flags)) as Parameters<
          typeof client.agents.reSyncAgentInsuranceCompanyWithInsurance
        >[0],
      ),
    );
    printSuccess(ctx, flags, 'Re-sync triggered');
  },
);
const insuranceCompanies = buildRouteMap<string, LocalContext>({
  docs: { brief: 'Agent insurance-company connections' },
  routes: {
    list: icList,
    add: icAdd,
    remove: icRemove,
    branches: icBranches,
    connection: icConnection,
    'update-connection': icUpdateConnection,
    'update-branches': icUpdateBranches,
    resync: icResync,
  },
});

const b2cGet = cmd0('Get B2C config fields', {}, ({ client }) =>
  take(client.agents.getB2CConfigFields()),
);
const b2cUpdate = cmd0<DataFlags>(
  'Update B2C config fields (body via --data)',
  dataFlag,
  async ({ client, ctx, flags }) => {
    await take(
      client.agents.updateB2CConfigFields(
        (await readData(flags)) as Parameters<typeof client.agents.updateB2CConfigFields>[0],
      ),
    );
    printSuccess(ctx, flags, 'B2C config updated');
  },
);
const b2cConfig = buildRouteMap<string, LocalContext>({
  docs: { brief: 'B2C configuration fields' },
  routes: { get: b2cGet, update: b2cUpdate },
});

export const agentRoutes = buildRouteMap<string, LocalContext>({
  docs: { brief: 'Manage the agent profile and connections' },
  routes: { me, update, 'insurance-companies': insuranceCompanies, 'b2c-config': b2cConfig },
});
