import type { InsurUpScope, OAuthTokens } from '@insurup/sdk';
import { buildCommand } from '@stricli/core';
import { browserLogin } from '../../auth/browser-login.ts';
import { createAuth } from '../../auth/factory.ts';
import { getClientSecret, setClientSecret } from '../../auth/keychain-storage.ts';
import { m2mLogin } from '../../auth/m2m.ts';
import { type ResolvedConfig, readConfigFile, writeConfigFile } from '../../config/config.ts';
import type { LocalContext } from '../../context.ts';
import { printData, printNote, printSuccess, runCommand } from '../../output/print.ts';
import { loadConfig } from '../../session.ts';
import { CliError } from '../../shared/errors.ts';
import { EXIT } from '../../shared/exit-codes.ts';
import { type GlobalFlags, globalFlags } from '../../shared/flags.ts';
import { promptHidden } from '../../shared/prompt.ts';

interface LoginFlags extends GlobalFlags {
  readonly m2m: boolean;
  readonly noBrowser: boolean;
  readonly clientSecret?: string;
  readonly save: boolean;
}

/** Persist clientId/authServer/scopes to the active profile in the config file. */
async function saveProfile(ctx: LocalContext, config: ResolvedConfig): Promise<void> {
  const file = await readConfigFile(ctx.env);
  const profiles = { ...(file.profiles ?? {}) };
  profiles[config.profile] = {
    ...profiles[config.profile],
    ...(config.clientId ? { clientId: config.clientId } : {}),
    authServer: config.authServer,
    ...(config.apiBaseUrl ? { apiBaseUrl: config.apiBaseUrl } : {}),
    scopes: [...config.scopes],
  };
  await writeConfigFile({ ...file, profiles }, ctx.env);
}

async function resolveSecret(
  ctx: LocalContext,
  flags: LoginFlags,
  config: ResolvedConfig,
): Promise<string> {
  const known =
    flags.clientSecret ?? config.clientSecret ?? (await getClientSecret(config.profile));
  if (known) return known;
  if (ctx.process === process && process.stdin.isTTY) {
    return promptHidden('Client secret: ');
  }
  throw new CliError(
    'No client secret. Provide --client-secret, set INSURUP_CLIENT_SECRET, or run interactively.',
    EXIT.USAGE,
  );
}

export const loginCommand = buildCommand<LoginFlags, [], LocalContext>({
  docs: {
    brief: 'Log in via browser (authorization code + PKCE) or --m2m (client credentials)',
  },
  parameters: {
    flags: {
      ...globalFlags,
      m2m: {
        kind: 'boolean',
        brief: 'Use machine-to-machine (client credentials) flow',
        default: false,
      },
      noBrowser: {
        kind: 'boolean',
        brief: 'Print the authorize URL instead of opening a browser',
        default: false,
      },
      clientSecret: { kind: 'parsed', parse: String, brief: 'M2M client secret', optional: true },
      save: {
        kind: 'boolean',
        brief: 'Persist client id/secret + settings to this profile',
        default: false,
      },
    },
  },
  func: function (this: LocalContext, flags: LoginFlags): Promise<void> {
    return runCommand(this, flags, async () => {
      const config = await loadConfig(this, flags);
      if (!config.clientId) {
        throw new CliError(
          'No client id. Provide --client-id, set INSURUP_CLIENT_ID, or configure a profile.',
          EXIT.USAGE,
        );
      }
      const auth = createAuth(config);
      const scopes = config.scopes as readonly InsurUpScope[];
      let tokens: OAuthTokens;

      if (flags.m2m) {
        const clientSecret = await resolveSecret(this, flags, config);
        tokens = await m2mLogin(auth, { clientSecret, scopes });
        if (flags.save) await setClientSecret(config.profile, clientSecret);
      } else {
        printNote(this, flags, 'Opening browser for sign-in…');
        tokens = await browserLogin(auth, {
          scopes,
          noBrowser: flags.noBrowser,
          onAuthorizeUrl: (url) => printNote(this, flags, `Authorize at: ${url}`),
        });
      }

      if (flags.save) await saveProfile(this, config);

      const summary = {
        ok: true,
        profile: config.profile,
        flow: flags.m2m ? 'client_credentials' : 'authorization_code',
        expiresAt: tokens.expiresAt ? new Date(tokens.expiresAt).toISOString() : undefined,
        scopes: tokens.scope?.split(' ') ?? [...config.scopes],
      };
      if (flags.json) printData(this, flags, summary);
      else printSuccess(this, flags, `Logged in to profile "${config.profile}"`);
    });
  },
});
