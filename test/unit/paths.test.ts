import { describe, expect, test } from 'bun:test';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { configDir, configFilePath } from '../../src/config/paths.ts';

describe('configDir', () => {
  test('uses XDG_CONFIG_HOME when set', () => {
    expect(configDir({ XDG_CONFIG_HOME: '/tmp/xdg' })).toBe('/tmp/xdg/insurup');
  });
  test('falls back to ~/.config/insurup', () => {
    expect(configDir({})).toBe(join(homedir(), '.config', 'insurup'));
  });
  test('configFilePath appends config.json', () => {
    expect(configFilePath({ XDG_CONFIG_HOME: '/tmp/xdg' })).toBe('/tmp/xdg/insurup/config.json');
  });
});
