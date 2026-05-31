import { describe, expect, test } from 'bun:test';
import type { InsurUpAuth, OAuthTokens } from '@insurup/sdk';
import { browserLogin } from '../../src/auth/browser-login.ts';
import type { CallbackResult, CallbackServer } from '../../src/auth/callback-server.ts';
import { CliError } from '../../src/shared/errors.ts';
import { EXIT } from '../../src/shared/exit-codes.ts';

const tokens: OAuthTokens = { accessToken: 'a', tokenType: 'bearer', expiresAt: 1 };

function fakeAuth(overrides: Partial<InsurUpAuth> = {}): InsurUpAuth {
  return {
    getAuthorizeUrl: async () => ({ url: 'https://auth/authorize', codeVerifier: 'v', state: 's' }),
    exchangeCode: async () => ({ isSuccess: true, kind: 'success', data: tokens }),
    ...overrides,
  } as unknown as InsurUpAuth;
}

function fakeServer(result: Promise<CallbackResult>): () => CallbackServer {
  return () => ({ result, redirectUri: 'http://localhost:0/callback', stop: () => {} });
}

describe('browserLogin', () => {
  test('completes the flow and returns tokens; opens the browser', async () => {
    let opened = '';
    const result = await browserLogin(fakeAuth(), {
      deps: {
        open: async (url) => {
          opened = url;
        },
        startCallbackServer: fakeServer(Promise.resolve({ code: 'c', state: 's' })),
      },
    });
    expect(result).toEqual(tokens);
    expect(opened).toBe('https://auth/authorize');
  });

  test('always requests PAR and forwards the iss parameter to the code exchange', async () => {
    let authorizeUsePAR: boolean | undefined;
    let exchangedIss: string | null | undefined;
    const auth = fakeAuth({
      getAuthorizeUrl: async (opts) => {
        authorizeUsePAR = opts.usePAR;
        return { url: 'https://auth/authorize', codeVerifier: 'v', state: 's' };
      },
      exchangeCode: async (opts) => {
        exchangedIss = new URL(opts.callbackUrl).searchParams.get('iss');
        return { isSuccess: true, kind: 'success', data: tokens } as never;
      },
    });
    await browserLogin(auth, {
      deps: {
        open: async () => {},
        startCallbackServer: fakeServer(
          Promise.resolve({ code: 'c', state: 's', iss: 'https://auth.insurup.com/' }),
        ),
      },
    });
    expect(authorizeUsePAR).toBe(true);
    expect(exchangedIss).toBe('https://auth.insurup.com/');
  });

  test('does not open the browser when noBrowser is set', async () => {
    let opened = false;
    await browserLogin(fakeAuth(), {
      noBrowser: true,
      deps: {
        open: async () => {
          opened = true;
        },
        startCallbackServer: fakeServer(Promise.resolve({ code: 'c' })),
      },
    });
    expect(opened).toBe(false);
  });

  test('throws AUTH on an error callback', async () => {
    const promise = browserLogin(fakeAuth(), {
      deps: {
        open: async () => {},
        startCallbackServer: fakeServer(
          Promise.resolve({ error: 'denied', errorDescription: 'no' }),
        ),
      },
    });
    await expect(promise).rejects.toMatchObject({ exitCode: EXIT.AUTH });
  });

  test('throws AUTH when the token exchange fails', async () => {
    const auth = fakeAuth({
      exchangeCode: async () =>
        ({ isSuccess: false, kind: 'failure', error: { message: 'bad code' } }) as never,
    });
    const promise = browserLogin(auth, {
      deps: {
        open: async () => {},
        startCallbackServer: fakeServer(Promise.resolve({ code: 'c' })),
      },
    });
    await expect(promise).rejects.toBeInstanceOf(CliError);
  });

  test('times out when no callback arrives', async () => {
    const promise = browserLogin(fakeAuth(), {
      timeoutMs: 10,
      deps: {
        open: async () => {},
        startCallbackServer: fakeServer(new Promise<CallbackResult>(() => {})),
      },
    });
    await expect(promise).rejects.toMatchObject({ exitCode: EXIT.AUTH });
  });
});
