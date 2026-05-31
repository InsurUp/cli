import { buildCommand } from '@stricli/core';
import type { LocalContext } from '../../context.ts';
import { printData, runCommand } from '../../output/print.ts';
import { createSession } from '../../session.ts';
import { CliError } from '../../shared/errors.ts';
import { EXIT } from '../../shared/exit-codes.ts';
import { type GlobalFlags, globalFlags } from '../../shared/flags.ts';

export const tokenCommand = buildCommand<GlobalFlags, [], LocalContext>({
  docs: {
    brief: 'Print a valid access token to stdout (auto-refresh); useful as $(insurup auth token)',
  },
  parameters: { flags: { ...globalFlags } },
  func: function (this: LocalContext, flags: GlobalFlags): Promise<void> {
    return runCommand(this, flags, async () => {
      const session = await createSession(this, flags);
      const token = await session.getAccessToken();
      if (!token) {
        throw new CliError('Not authenticated. Run `insurup auth login` first.', EXIT.AUTH);
      }
      if (flags.json) {
        printData(this, flags, { accessToken: token });
      } else {
        this.process.stdout.write(`${token}\n`);
      }
    });
  },
});
