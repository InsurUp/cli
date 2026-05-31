import { buildRouteMap } from '@stricli/core';
import type { LocalContext } from '../context.ts';
import { cmd0 } from './_factory.ts';
import { type DataFlags, dataFlag, readData, take } from './_shared.ts';

const enter = cmd0<DataFlags>(
  'Enter an agent setup request (body via --data)',
  dataFlag,
  async ({ client, flags }) =>
    take(
      client.agentSetup.enterAgentSetupRequest(
        (await readData(flags)) as Parameters<typeof client.agentSetup.enterAgentSetupRequest>[0],
      ),
    ),
);
const complete = cmd0<DataFlags>(
  'Complete an agent setup request (body via --data)',
  dataFlag,
  async ({ client, flags }) =>
    take(
      client.agentSetup.completeAgentSetupRequest(
        (await readData(flags)) as Parameters<
          typeof client.agentSetup.completeAgentSetupRequest
        >[0],
      ),
    ),
);

export const agentSetupRoutes = buildRouteMap<string, LocalContext>({
  docs: { brief: 'Agent onboarding/setup requests' },
  routes: { enter, complete },
});
