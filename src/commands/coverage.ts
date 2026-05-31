import { buildRouteMap } from '@stricli/core';
import type { LocalContext } from '../context.ts';
import { printSuccess } from '../output/print.ts';
import { cmd0, cmd1 } from './_factory.ts';
import { type DataFlags, dataFlag, readData, take } from './_shared.ts';

const list = cmd0('List coverage groups', {}, ({ client }) =>
  take(client.coverage.getAllCoverageGroups()),
);
const get = cmd1('Get a coverage group by id', 'Coverage group id', {}, ({ client }, id) =>
  take(client.coverage.getCoverageGroupById(id)),
);
const create = cmd0<DataFlags>(
  'Create a coverage group (body via --data)',
  dataFlag,
  async ({ client, flags }) =>
    take(
      client.coverage.createCoverageGroup(
        (await readData(flags)) as Parameters<typeof client.coverage.createCoverageGroup>[0],
      ),
    ),
);
const update = cmd0<DataFlags>(
  'Update a coverage group (body via --data)',
  dataFlag,
  async ({ client, ctx, flags }) => {
    await take(
      client.coverage.updateCoverageGroup(
        (await readData(flags)) as Parameters<typeof client.coverage.updateCoverageGroup>[0],
      ),
    );
    printSuccess(ctx, flags, 'Coverage group updated');
  },
);
const del = cmd1(
  'Delete a coverage group by id',
  'Coverage group id',
  {},
  async ({ client, ctx, flags }, id) => {
    await take(client.coverage.deleteCoverageGroup({ id }));
    printSuccess(ctx, flags, `Deleted coverage group ${id}`);
  },
);
const groups = buildRouteMap<string, LocalContext>({
  docs: { brief: 'Coverage groups' },
  routes: { list, get, create, update, delete: del },
});

const kasko = cmd0('Get Kasko coverage choices', {}, ({ client }) =>
  take(client.coverage.getKaskoCoverageChoices()),
);
const konut = cmd0('Get Konut coverage choices', {}, ({ client }) =>
  take(client.coverage.getKonutCoverageChoices()),
);
const tss = cmd0('Get TSS coverage choices', {}, ({ client }) =>
  take(client.coverage.getTssCoverageChoices()),
);
const imm = cmd0('Get IMM coverage choices', {}, ({ client }) =>
  take(client.coverage.getImmCoverageChoices()),
);
const choices = buildRouteMap<string, LocalContext>({
  docs: { brief: 'Available coverage choices by branch' },
  routes: { kasko, konut, tss, imm },
});

export const coverageRoutes = buildRouteMap<string, LocalContext>({
  docs: { brief: 'Manage coverage groups and choices' },
  routes: { groups, choices },
});
