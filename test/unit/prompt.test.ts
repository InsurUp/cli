import { describe, expect, test } from 'bun:test';
import { promptHidden } from '../../src/shared/prompt.ts';

describe('promptHidden', () => {
  test('rejects when stdin is not a TTY (non-interactive)', async () => {
    if (process.stdin.isTTY) return; // would block on a real terminal; only assert the guard
    await expect(promptHidden('Secret: ')).rejects.toThrow('not a TTY');
  });
});
