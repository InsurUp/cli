export type ApiHandler = (req: Request, url: URL) => Response | Promise<Response>;

export interface MockServer {
  /** Authorization server issuer base URL. */
  readonly authServer: string;
  /** API base URL (trailing slash) to pass via --base-url. */
  readonly apiBaseUrl: string;
  /** Replace the catch-all `/api/*` handler. */
  setApiHandler(handler: ApiHandler): void;
  /** Number of token-endpoint requests received. */
  tokenRequestCount(): number;
  stop(): void;
}

/**
 * A mock InsurUp OAuth + API server on an ephemeral port. Serves OIDC discovery
 * and a client-credentials token endpoint, plus a configurable `/api/*` handler.
 */
export function startMockServer(): MockServer {
  let apiHandler: ApiHandler = () =>
    new Response('[]', { headers: { 'content-type': 'application/json' } });
  let tokenRequests = 0;
  let server!: ReturnType<typeof Bun.serve>;

  server = Bun.serve({
    port: 0,
    fetch(req) {
      const url = new URL(req.url);
      const issuer = `http://localhost:${server.port}`;

      if (url.pathname === '/.well-known/openid-configuration') {
        return Response.json({
          issuer,
          token_endpoint: `${issuer}/connect/token`,
          authorization_endpoint: `${issuer}/connect/authorize`,
          response_types_supported: ['code'],
          grant_types_supported: ['client_credentials', 'authorization_code', 'refresh_token'],
          code_challenge_methods_supported: ['S256'],
        });
      }
      if (url.pathname === '/connect/token') {
        tokenRequests += 1;
        return Response.json({
          access_token: 'mock-access-token',
          token_type: 'Bearer',
          expires_in: 3600,
          scope: 'core-api',
        });
      }
      if (url.pathname.startsWith('/api/')) {
        return apiHandler(req, url);
      }
      return new Response('not found', { status: 404 });
    },
  });

  const base = `http://localhost:${server.port}`;
  return {
    authServer: base,
    apiBaseUrl: `${base}/api/`,
    setApiHandler: (h) => {
      apiHandler = h;
    },
    tokenRequestCount: () => tokenRequests,
    stop: () => server.stop(true),
  };
}
