import { describe, expect, test } from 'bun:test';
import { startCallbackServer } from '../../src/auth/callback-server.ts';

describe('startCallbackServer', () => {
  test('resolves with the code + state and shows a success page', async () => {
    const server = startCallbackServer();
    const res = await fetch(`${server.redirectUri}?code=abc&state=xyz`);
    const html = await res.text();
    expect(html).toContain('successful');
    expect(await server.result).toEqual({
      code: 'abc',
      state: 'xyz',
      error: undefined,
      errorDescription: undefined,
    });
    server.stop();
  });

  test('resolves with an error and shows a failure page', async () => {
    const server = startCallbackServer();
    const res = await fetch(`${server.redirectUri}?error=access_denied&error_description=nope`);
    expect(await res.text()).toContain('failed');
    const result = await server.result;
    expect(result.error).toBe('access_denied');
    expect(result.errorDescription).toBe('nope');
    server.stop();
  });

  test('serves favicon (204) and 404 for unknown paths', async () => {
    const server = startCallbackServer();
    const base = server.redirectUri.replace('/callback', '');
    expect((await fetch(`${base}/favicon.ico`)).status).toBe(204);
    expect((await fetch(`${base}/nope`)).status).toBe(404);
    server.stop();
  });

  test('shows a waiting page when no code/error is present', async () => {
    const server = startCallbackServer();
    expect(await (await fetch(server.redirectUri)).text()).toContain('Waiting');
    server.stop();
  });
});
