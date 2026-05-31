import { describe, expect, test } from 'bun:test';
import type { InsurUpScope } from '@insurup/sdk';
import { m2mScopes } from '../../src/auth/m2m.ts';

describe('m2mScopes', () => {
  test('drops OIDC/interactive-only scopes invalid for client-credentials', () => {
    const input = [
      'openid',
      'profile',
      'email',
      'roles',
      'offline_access',
      'core-api',
      'customer:read',
    ] as InsurUpScope[];
    expect(m2mScopes(input)).toEqual(['core-api', 'customer:read']);
  });

  test('leaves API-only scope lists unchanged', () => {
    expect(m2mScopes(['core-api'] as InsurUpScope[])).toEqual(['core-api']);
  });
});
