/**
 * Local loopback HTTP server that captures the OAuth2 authorization-code
 * redirect. Adapted from the InsurUp SDK Bun CLI demo. Binds to an ephemeral
 * port (`port: 0`) and resolves with the code/state (or error) from `/callback`.
 */

export interface CallbackResult {
  readonly code?: string;
  readonly state?: string;
  readonly error?: string;
  readonly errorDescription?: string;
}

export interface CallbackServer {
  /** Resolves once the browser hits the redirect URI. */
  readonly result: Promise<CallbackResult>;
  /** The redirect URI the auth server should call back. */
  readonly redirectUri: string;
  /** Shut the server down. Always call this when done. */
  readonly stop: () => void;
}

function page(title: string, heading: string, body: string, accent: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title><style>
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;display:flex;
    justify-content:center;align-items:center;height:100vh;margin:0;background:${accent}}
    .card{text-align:center;background:#fff;padding:3rem;border-radius:16px;max-width:420px;
    box-shadow:0 10px 40px rgba(0,0,0,.2)}h1{color:#1f2937;margin:0 0 .5rem;font-size:1.5rem}
    p{color:#6b7280;margin:0}</style></head><body><div class="card"><h1>${heading}</h1><p>${body}</p></div></body></html>`;
}

const SUCCESS = page(
  'Authentication Successful',
  'Authentication successful',
  'You can close this window and return to the terminal.',
  'linear-gradient(135deg,#667eea,#764ba2)',
);

/** Start the loopback callback server and begin awaiting the OAuth redirect. */
export function startCallbackServer(port = 0): CallbackServer {
  let resolve!: (result: CallbackResult) => void;
  const result = new Promise<CallbackResult>((r) => {
    resolve = r;
  });

  const server = Bun.serve({
    port,
    fetch(req) {
      const url = new URL(req.url);
      if (url.pathname === '/favicon.ico') return new Response(null, { status: 204 });
      if (url.pathname !== '/callback' && url.pathname !== '/') {
        return new Response('Not found', { status: 404 });
      }
      const error = url.searchParams.get('error') ?? undefined;
      const code = url.searchParams.get('code') ?? undefined;
      const state = url.searchParams.get('state') ?? undefined;
      if (error || code) {
        resolve({
          code,
          state,
          error,
          errorDescription: url.searchParams.get('error_description') ?? undefined,
        });
        const heading = error ? 'Authentication failed' : 'Authentication successful';
        const html = error
          ? page('Authentication Failed', heading, error, 'linear-gradient(135deg,#ef4444,#dc2626)')
          : SUCCESS;
        return new Response(html, { headers: { 'Content-Type': 'text/html' } });
      }
      return new Response('Waiting for authentication…', {
        headers: { 'Content-Type': 'text/plain' },
      });
    },
  });

  return {
    result,
    redirectUri: `http://localhost:${server.port}/callback`,
    stop: () => server.stop(true),
  };
}
