import { buildCommand } from '@stricli/core';
import { resolveIdentity } from '../../auth/whoami.ts';
import type { LocalContext } from '../../context.ts';
import { printData, runCommand } from '../../output/print.ts';
import { createSession } from '../../session.ts';
import { type GlobalFlags, globalFlags } from '../../shared/flags.ts';

export const whoamiCommand = buildCommand<GlobalFlags, [], LocalContext>({
  docs: { brief: 'Show the authenticated identity (agent user, agent, or customer)' },
  parameters: { flags: { ...globalFlags } },
  func: function (this: LocalContext, flags: GlobalFlags): Promise<void> {
    return runCommand(this, flags, async () => {
      const session = await createSession(this, flags);
      const identity = await resolveIdentity(session.client);
      printData(this, flags, { identityKind: identity.kind, ...(identity.data as object) });
    });
  },
});
