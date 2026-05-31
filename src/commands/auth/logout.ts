import { buildCommand } from '@stricli/core';
import { clearClientSecret, clearTokens } from '../../auth/keychain-storage.ts';
import type { ResolvedConfig } from '../../config/config.ts';
import type { LocalContext } from '../../context.ts';
import { printSuccess, runCommand } from '../../output/print.ts';
import { loadConfig } from '../../session.ts';
import { type GlobalFlags, globalFlags } from '../../shared/flags.ts';

interface LogoutFlags extends GlobalFlags {
  readonly forgetSecret: boolean;
}

export const logoutCommand = buildCommand<LogoutFlags, [], LocalContext>({
  docs: { brief: 'Clear stored tokens for the active profile' },
  parameters: {
    flags: {
      ...globalFlags,
      forgetSecret: {
        kind: 'boolean',
        brief: 'Also remove the stored M2M client secret',
        default: false,
      },
    },
  },
  func: function (this: LocalContext, flags: LogoutFlags): Promise<void> {
    return runCommand(this, flags, async () => {
      const config: ResolvedConfig = await loadConfig(this, flags);
      await clearTokens(config.profile);
      if (flags.forgetSecret) await clearClientSecret(config.profile);
      printSuccess(this, flags, `Logged out of profile "${config.profile}"`);
    });
  },
});
