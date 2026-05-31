import { buildRouteMap } from '@stricli/core';
import type { LocalContext } from '../context.ts';
import { printSuccess } from '../output/print.ts';
import { cmd0, cmd1, cmd2 } from './_factory.ts';
import { type DataFlags, dataFlag, readData, take } from './_shared.ts';

const get = cmd1('Get proposal detail by id', 'Proposal id', {}, ({ client }, id) =>
  take(client.proposals.getProposalDetail(id)),
);

const create = cmd0<DataFlags>(
  'Create a proposal (body via --data)',
  dataFlag,
  async ({ client, flags }) =>
    take(
      client.proposals.createProposal(
        (await readData(flags)) as Parameters<typeof client.proposals.createProposal>[0],
      ),
    ),
);

const coverage = cmd2(
  'Get a proposal product’s coverage',
  'Proposal id',
  'Product id',
  {},
  ({ client }, p, prod) => take(client.proposals.getProposalProductCoverage(p, prod)),
);

const retry = cmd2(
  'Retry a failed proposal product',
  'Proposal id',
  'Product id',
  {},
  async ({ client, ctx, flags }, p, prod) => {
    await take(client.proposals.retryFailedProposalProduct(p, prod));
    printSuccess(ctx, flags, 'Retry requested');
  },
);

const purchaseSync = cmd0<DataFlags>(
  'Purchase a proposal product synchronously (body via --data)',
  dataFlag,
  async ({ client, flags }) =>
    take(
      client.proposals.purchaseProposalProductSync(
        (await readData(flags)) as Parameters<
          typeof client.proposals.purchaseProposalProductSync
        >[0],
      ),
    ),
);

const purchaseAsync = cmd0<DataFlags>(
  'Purchase a proposal product asynchronously (body via --data)',
  dataFlag,
  async ({ client, flags }) =>
    take(
      client.proposals.purchaseProposalProductAsync(
        (await readData(flags)) as Parameters<
          typeof client.proposals.purchaseProposalProductAsync
        >[0],
      ),
    ),
);

const revise = cmd0<DataFlags>(
  'Revise a proposal (body via --data)',
  dataFlag,
  async ({ client, flags }) =>
    take(
      client.proposals.reviseProposal(
        (await readData(flags)) as Parameters<typeof client.proposals.reviseProposal>[0],
      ),
    ),
);

const setRepresentative = cmd0<DataFlags>(
  'Set the proposal representative (body via --data)',
  dataFlag,
  async ({ client, ctx, flags }) => {
    await take(
      client.proposals.setProposalRepresentative(
        (await readData(flags)) as Parameters<typeof client.proposals.setProposalRepresentative>[0],
      ),
    );
    printSuccess(ctx, flags, 'Representative set');
  },
);

const setBranch = cmd0<DataFlags>(
  'Set the proposal branch (body via --data)',
  dataFlag,
  async ({ client, ctx, flags }) => {
    await take(
      client.proposals.setProposalBranch(
        (await readData(flags)) as Parameters<typeof client.proposals.setProposalBranch>[0],
      ),
    );
    printSuccess(ctx, flags, 'Branch set');
  },
);

const conversionTrend = cmd0<DataFlags>(
  'Proposal conversion-trend analytics (body via --data)',
  dataFlag,
  async ({ client, flags }) =>
    take(
      client.proposals.getProposalConversionTrend(
        (await readData(flags)) as Parameters<
          typeof client.proposals.getProposalConversionTrend
        >[0],
      ),
    ),
);

const watch = cmd1(
  'Stream proposal detail updates (SignalR) until Ctrl-C',
  'Proposal id',
  {},
  async ({ client, ctx }, id) => {
    const emit = (type: string, event: unknown): void => {
      ctx.process.stdout.write(`${JSON.stringify({ type, event })}\n`);
    };
    const unsubscribe = await client.proposals.subscribeToDetail(id, {
      onProductInProgress: (e) => emit('product_in_progress', e),
      onProductSuccess: (e) => emit('product_success', e),
      onProductFailed: (e) => emit('product_failed', e),
      onProductRevised: (e) => emit('product_revised', e),
      onProductPurchasing: (e) => emit('product_purchasing', e),
      onProductPurchased: (e) => emit('product_purchased', e),
      onProductPurchaseFailed: (e) => emit('product_purchase_failed', e),
      onProductCoverage: (e) => emit('product_coverage', e),
    });
    await new Promise<void>((resolve) => {
      process.once('SIGINT', () => {
        unsubscribe();
        resolve();
      });
    });
    await client.close();
  },
);

export const proposalRoutes = buildRouteMap<string, LocalContext>({
  docs: { brief: 'Manage proposals, purchasing, revisions, and live updates' },
  routes: {
    get,
    create,
    coverage,
    retry,
    'purchase-sync': purchaseSync,
    'purchase-async': purchaseAsync,
    revise,
    'set-representative': setRepresentative,
    'set-branch': setBranch,
    'conversion-trend': conversionTrend,
    watch,
  },
});
