import { buildRouteMap } from '@stricli/core';
import type { LocalContext } from '../context.ts';
import { printSuccess } from '../output/print.ts';
import { cmd0, cmd1 } from './_factory.ts';
import { type DataFlags, dataFlag, readData, take } from './_shared.ts';

const get = cmd1('Get policy detail by id', 'Policy id', {}, ({ client }, policyId) =>
  take(client.policies.getPolicyDetail({ policyId })),
);

const document = cmd1('Fetch a policy document by id', 'Policy id', {}, ({ client }, policyId) =>
  take(client.policies.fetchPolicyDocument({ policyId })),
);

const sendDocument = cmd0<DataFlags>(
  'Send a policy document to the customer (body via --data)',
  dataFlag,
  async ({ client, ctx, flags }) => {
    await take(
      client.policies.sendPolicyDocumentToCustomer(
        (await readData(flags)) as Parameters<
          typeof client.policies.sendPolicyDocumentToCustomer
        >[0],
      ),
    );
    printSuccess(ctx, flags, 'Policy document sent');
  },
);

const setRepresentative = cmd0<DataFlags>(
  'Set the policy representative (body via --data)',
  dataFlag,
  async ({ client, ctx, flags }) => {
    await take(
      client.policies.setPolicyRepresentative(
        (await readData(flags)) as Parameters<typeof client.policies.setPolicyRepresentative>[0],
      ),
    );
    printSuccess(ctx, flags, 'Representative set');
  },
);

const setBranch = cmd0<DataFlags>(
  'Set the policy branch (body via --data)',
  dataFlag,
  async ({ client, ctx, flags }) => {
    await take(
      client.policies.setPolicyBranch(
        (await readData(flags)) as Parameters<typeof client.policies.setPolicyBranch>[0],
      ),
    );
    printSuccess(ctx, flags, 'Branch set');
  },
);

const createManual = cmd0<DataFlags>(
  'Create a manual policy (body via --data)',
  dataFlag,
  async ({ client, flags }) =>
    take(
      client.policies.createManualPolicy(
        (await readData(flags)) as Parameters<typeof client.policies.createManualPolicy>[0],
      ),
    ),
);

const updateManual = cmd0<DataFlags>(
  'Update a manual policy (body via --data)',
  dataFlag,
  async ({ client, ctx, flags }) => {
    await take(
      client.policies.updateManualPolicy(
        (await readData(flags)) as Parameters<typeof client.policies.updateManualPolicy>[0],
      ),
    );
    printSuccess(ctx, flags, 'Manual policy updated');
  },
);

// Transfers
const transferGet = cmd0<DataFlags>(
  'Get a policy transfer detail (body via --data)',
  dataFlag,
  async ({ client, flags }) =>
    take(
      client.policies.getPolicyTransferDetail(
        (await readData(flags)) as Parameters<typeof client.policies.getPolicyTransferDetail>[0],
      ),
    ),
);
const transferCreate = cmd0<DataFlags>(
  'Create a policy transfer (body via --data)',
  dataFlag,
  async ({ client, flags }) =>
    take(
      client.policies.createPolicyTransfer(
        (await readData(flags)) as Parameters<typeof client.policies.createPolicyTransfer>[0],
      ),
    ),
);
const transferTrigger = cmd0<DataFlags>(
  'Trigger a policy transfer (body via --data)',
  dataFlag,
  async ({ client, ctx, flags }) => {
    await take(
      client.policies.triggerPolicyTransfer(
        (await readData(flags)) as Parameters<typeof client.policies.triggerPolicyTransfer>[0],
      ),
    );
    printSuccess(ctx, flags, 'Transfer triggered');
  },
);
const transfers = buildRouteMap<string, LocalContext>({
  docs: { brief: 'Policy transfers' },
  routes: { get: transferGet, create: transferCreate, trigger: transferTrigger },
});

// Analytics
const aPremium = cmd0<DataFlags>(
  'Policy count & premium analytics (body via --data)',
  dataFlag,
  async ({ client, flags }) =>
    take(
      client.policies.getPolicyCountAndPremiumAnalytics(
        (await readData(flags)) as Parameters<
          typeof client.policies.getPolicyCountAndPremiumAnalytics
        >[0],
      ),
    ),
);
const aRenewal = cmd0<DataFlags>(
  'Policy renewal analytics (body via --data)',
  dataFlag,
  async ({ client, flags }) =>
    take(
      client.policies.getPolicyRenewalAnalytics(
        (await readData(flags)) as Parameters<typeof client.policies.getPolicyRenewalAnalytics>[0],
      ),
    ),
);
const aDistribution = cmd0<DataFlags>(
  'Policy distribution by branch (body via --data)',
  dataFlag,
  async ({ client, flags }) =>
    take(
      client.policies.getPolicyDistributionByBranch(
        (await readData(flags)) as Parameters<
          typeof client.policies.getPolicyDistributionByBranch
        >[0],
      ),
    ),
);
const aEarnings = cmd0<DataFlags>(
  'Representative earnings analytics (body via --data)',
  dataFlag,
  async ({ client, flags }) =>
    take(
      client.policies.getRepresentativeEarningsAnalytics(
        (await readData(flags)) as Parameters<
          typeof client.policies.getRepresentativeEarningsAnalytics
        >[0],
      ),
    ),
);
const analytics = buildRouteMap<string, LocalContext>({
  docs: { brief: 'Policy analytics' },
  routes: {
    premium: aPremium,
    renewal: aRenewal,
    distribution: aDistribution,
    earnings: aEarnings,
  },
});

export const policyRoutes = buildRouteMap<string, LocalContext>({
  docs: { brief: 'Manage policies, documents, transfers, and analytics' },
  routes: {
    get,
    document,
    'send-document': sendDocument,
    'set-representative': setRepresentative,
    'set-branch': setBranch,
    'create-manual': createManual,
    'update-manual': updateManual,
    transfers,
    analytics,
  },
});
