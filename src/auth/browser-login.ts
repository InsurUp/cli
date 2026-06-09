import type { InsurUpAuth, InsurUpScope, OAuthTokens } from '@insurup/sdk';
import open from 'open';
import { CliError } from '../shared/errors.ts';
import { EXIT } from '../shared/exit-codes.ts';
import { type CallbackResult, startCallbackServer } from './callback-server.ts';

const DEFAULT_TIMEOUT_MS = 5 * 60 * 1000;

export interface BrowserLoginDeps {
  /** Launch a URL in the browser. Defaults to the `open` package. */
  readonly open?: (url: string) => Promise<unknown>;
  /** Start the loopback callback server. Defaults to {@link startCallbackServer}. */
  readonly startCallbackServer?: typeof startCallbackServer;
}

export interface BrowserLoginOptions {
  readonly scopes?: readonly InsurUpScope[];
  /** When true, print the URL instead of launching a browser (headless/SSH). */
  readonly noBrowser?: boolean;
  /** Called with the authorize URL so the caller can display it. */
  readonly onAuthorizeUrl?: (url: string) => void;
  readonly timeoutMs?: number;
  /** Injectable dependencies (tests override `open`/`startCallbackServer`). */
  readonly deps?: BrowserLoginDeps;
}

interface Timeout {
  readonly promise: Promise<never>;
  /** Clear the pending timer so it stops keeping the event loop alive. */
  readonly cancel: () => void;
}

function timeout(ms: number): Timeout {
  let handle: ReturnType<typeof setTimeout>;
  const promise = new Promise<never>((_resolve, reject) => {
    handle = setTimeout(
      () =>
        reject(new CliError(`Authentication timed out after ${Math.round(ms / 1000)}s`, EXIT.AUTH)),
      ms,
    );
  });
  return { promise, cancel: () => clearTimeout(handle) };
}

/**
 * Run the authorization-code + PKCE browser flow against a local loopback
 * redirect, returning the acquired tokens. The SDK persists them via the auth
 * handle's storage on success.
 */
export async function browserLogin(
  auth: InsurUpAuth,
  options: BrowserLoginOptions = {},
): Promise<OAuthTokens> {
  const startServer = options.deps?.startCallbackServer ?? startCallbackServer;
  const launch = options.deps?.open ?? open;
  const server = startServer();
  try {
    const { url, codeVerifier, state } = await auth.getAuthorizeUrl({
      redirectUri: server.redirectUri,
      // Always use Pushed Authorization Requests (RFC 9126): authorization
      // parameters go to the server's PAR endpoint over a back-channel and the
      // browser only ever sees a short one-shot `request_uri`. Requires the
      // `cli` client to be granted the PAR endpoint server-side.
      usePAR: true,
      ...(options.scopes ? { scopes: options.scopes } : {}),
    });

    options.onAuthorizeUrl?.(url);
    if (!options.noBrowser) {
      await launch(url).catch(() => {
        /* If the browser can't launch, the URL was already surfaced to the user. */
      });
    }

    const deadline = timeout(options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
    let callback: CallbackResult;
    try {
      callback = await Promise.race<CallbackResult>([server.result, deadline.promise]);
    } finally {
      // Clear the pending timer; otherwise it keeps the event loop alive and
      // the process hangs until the full timeout elapses (or Ctrl-C).
      deadline.cancel();
    }

    if (callback.error) {
      const detail = callback.errorDescription ? ` - ${callback.errorDescription}` : '';
      throw new CliError(`Authorization failed: ${callback.error}${detail}`, EXIT.AUTH);
    }
    if (!callback.code) {
      throw new CliError('No authorization code received', EXIT.AUTH);
    }

    const callbackUrl = new URL(server.redirectUri);
    callbackUrl.searchParams.set('code', callback.code);
    if (callback.state) callbackUrl.searchParams.set('state', callback.state);
    // Forward the RFC 9207 issuer parameter so the SDK can validate it. The
    // server advertises `authorization_response_iss_parameter_supported`, so
    // dropping `iss` would make the exchange fail with "iss (issuer) missing".
    if (callback.iss) callbackUrl.searchParams.set('iss', callback.iss);

    const exchange = await auth.exchangeCode({
      callbackUrl,
      redirectUri: server.redirectUri,
      codeVerifier,
      state,
    });
    if (!exchange.isSuccess) {
      throw new CliError(exchange.error.message, EXIT.AUTH);
    }
    return exchange.data;
  } finally {
    server.stop();
  }
}
