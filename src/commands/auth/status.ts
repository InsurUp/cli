import { buildCommand } from '@stricli/core';
import { readTokens } from '../../auth/keychain-storage.ts';
import type { LocalContext } from '../../context.ts';
import { printData, runCommand } from '../../output/print.ts';
import { loadConfig } from '../../session.ts';
import { type GlobalFlags, globalFlags } from '../../shared/flags.ts';

export const statusCommand = buildCommand<GlobalFlags, [], LocalContext>({
  docs: { brief: 'Show authentication status for the active profile (no network calls)' },
  parameters: { flags: { ...globalFlags } },
  func: function (this: LocalContext, flags: GlobalFlags): Promise<void> {
    return runCommand(this, flags, async () => {
      const config = await loadConfig(this, flags);
      const tokens = await readTokens(config.profile);
      const now = Date.now();
      const expired = tokens?.expiresAt !== undefined && tokens.expiresAt <= now;

      printData(this, flags, {
        profile: config.profile,
        authServer: config.authServer,
        clientId: config.clientId ?? null,
        authenticated: Boolean(tokens) && !expired,
        expiresAt: tokens?.expiresAt ? new Date(tokens.expiresAt).toISOString() : null,
        expired,
        hasRefreshToken: Boolean(tokens?.refreshToken),
        scopes: tokens?.scope?.split(' ') ?? [...config.scopes],
      });
    });
  },
});
