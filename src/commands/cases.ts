import { buildRouteMap } from '@stricli/core';
import type { LocalContext } from '../context.ts';
import { printSuccess } from '../output/print.ts';
import { cmd0, cmd1 } from './_factory.ts';
import { type DataFlags, dataFlag, readData, take } from './_shared.ts';

const get = cmd1('Get a case by reference', 'Case ref', {}, ({ client }, ref) =>
  take(client.cases.getCaseByRef(ref)),
);
const activities = cmd1('List a case’s activities', 'Case ref', {}, ({ client }, ref) =>
  take(client.cases.getCaseActivities(ref)),
);
const policies = cmd1('List a case’s policies', 'Case ref', {}, ({ client }, ref) =>
  take(client.cases.getCasePolicies(ref)),
);
const proposals = cmd1('List a case’s proposals', 'Case ref', {}, ({ client }, ref) =>
  take(client.cases.getCaseProposals(ref)),
);

const createSale = cmd0<DataFlags>(
  'Create a new-sale opportunity case (body via --data)',
  dataFlag,
  async ({ client, flags }) =>
    take(
      client.cases.createNewSaleOpportunityCase(
        (await readData(flags)) as Parameters<typeof client.cases.createNewSaleOpportunityCase>[0],
      ),
    ),
);
const createCrossSale = cmd0<DataFlags>(
  'Create a cross-sale opportunity case (body via --data)',
  dataFlag,
  async ({ client, flags }) =>
    take(
      client.cases.createCrossSaleOpportunityCase(
        (await readData(flags)) as Parameters<
          typeof client.cases.createCrossSaleOpportunityCase
        >[0],
      ),
    ),
);
const createCancel = cmd0<DataFlags>(
  'Create a cancellation case (body via --data)',
  dataFlag,
  async ({ client, flags }) =>
    take(
      client.cases.createCancelCase(
        (await readData(flags)) as Parameters<typeof client.cases.createCancelCase>[0],
      ),
    ),
);
const createEndorsement = cmd0<DataFlags>(
  'Create an endorsement case (body via --data)',
  dataFlag,
  async ({ client, flags }) =>
    take(
      client.cases.createEndorsementCase(
        (await readData(flags)) as Parameters<typeof client.cases.createEndorsementCase>[0],
      ),
    ),
);
const createComplaint = cmd0<DataFlags>(
  'Create a complaint case (body via --data)',
  dataFlag,
  async ({ client, flags }) =>
    take(
      client.cases.createComplaintCase(
        (await readData(flags)) as Parameters<typeof client.cases.createComplaintCase>[0],
      ),
    ),
);

const note = cmd0<DataFlags>(
  'Add a note to a case (body via --data)',
  dataFlag,
  async ({ client, ctx, flags }) => {
    await take(
      client.cases.addNoteToCase(
        (await readData(flags)) as Parameters<typeof client.cases.addNoteToCase>[0],
      ),
    );
    printSuccess(ctx, flags, 'Note added');
  },
);
const setState = cmd0<DataFlags>(
  'Change a case state (body via --data)',
  dataFlag,
  async ({ client, ctx, flags }) => {
    await take(
      client.cases.changeCaseState(
        (await readData(flags)) as Parameters<typeof client.cases.changeCaseState>[0],
      ),
    );
    printSuccess(ctx, flags, 'State changed');
  },
);
const setChannel = cmd0<DataFlags>(
  'Change a case channel (body via --data)',
  dataFlag,
  async ({ client, ctx, flags }) => {
    await take(
      client.cases.changeCaseChannel(
        (await readData(flags)) as Parameters<typeof client.cases.changeCaseChannel>[0],
      ),
    );
    printSuccess(ctx, flags, 'Channel changed');
  },
);
const setAsset = cmd0<DataFlags>(
  'Set a case asset (body via --data)',
  dataFlag,
  async ({ client, ctx, flags }) => {
    await take(
      client.cases.setCaseAsset(
        (await readData(flags)) as Parameters<typeof client.cases.setCaseAsset>[0],
      ),
    );
    printSuccess(ctx, flags, 'Asset set');
  },
);
const setBranch = cmd0<DataFlags>(
  'Set a case branch (body via --data)',
  dataFlag,
  async ({ client, ctx, flags }) => {
    await take(
      client.cases.setCaseBranch(
        (await readData(flags)) as Parameters<typeof client.cases.setCaseBranch>[0],
      ),
    );
    printSuccess(ctx, flags, 'Branch set');
  },
);
const setRepresentative = cmd0<DataFlags>(
  'Assign a case representative (body via --data)',
  dataFlag,
  async ({ client, ctx, flags }) => {
    await take(
      client.cases.assignCaseRepresentative(
        (await readData(flags)) as Parameters<typeof client.cases.assignCaseRepresentative>[0],
      ),
    );
    printSuccess(ctx, flags, 'Representative assigned');
  },
);

const automations = cmd0('List case communication automations', {}, ({ client }) =>
  take(client.cases.getAllCaseCommunicationAutomations()),
);
const priorityTemplates = cmd0('Get case priority templates', {}, ({ client }) =>
  take(client.cases.getCasePriorityTemplates()),
);

const aFunnel = cmd0<DataFlags>(
  'Sales-opportunity funnel analytics (body via --data)',
  dataFlag,
  async ({ client, flags }) =>
    take(
      client.cases.getSalesOpportunityFunnelAnalytics(
        (await readData(flags)) as Parameters<
          typeof client.cases.getSalesOpportunityFunnelAnalytics
        >[0],
      ),
    ),
);
const aBacklog = cmd0<DataFlags>(
  'Open-case backlog pivot analytics (body via --data)',
  dataFlag,
  async ({ client, flags }) =>
    take(
      client.cases.getOpenCaseBacklogPivotAnalytics(
        (await readData(flags)) as Parameters<
          typeof client.cases.getOpenCaseBacklogPivotAnalytics
        >[0],
      ),
    ),
);
const aFailed = cmd0<DataFlags>(
  'Failed-cases reason distribution (body via --data)',
  dataFlag,
  async ({ client, flags }) =>
    take(
      client.cases.getFailedCasesReasonDistribution(
        (await readData(flags)) as Parameters<
          typeof client.cases.getFailedCasesReasonDistribution
        >[0],
      ),
    ),
);
const analytics = buildRouteMap<string, LocalContext>({
  docs: { brief: 'Case analytics' },
  routes: { funnel: aFunnel, backlog: aBacklog, failed: aFailed },
});

export const caseRoutes = buildRouteMap<string, LocalContext>({
  docs: { brief: 'Manage cases (sales, claims, complaints, endorsements)' },
  routes: {
    get,
    activities,
    policies,
    proposals,
    'create-sale': createSale,
    'create-cross-sale': createCrossSale,
    'create-cancel': createCancel,
    'create-endorsement': createEndorsement,
    'create-complaint': createComplaint,
    note,
    'set-state': setState,
    'set-channel': setChannel,
    'set-asset': setAsset,
    'set-branch': setBranch,
    'set-representative': setRepresentative,
    automations,
    'priority-templates': priorityTemplates,
    analytics,
  },
});
