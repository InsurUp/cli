import { buildRouteMap } from '@stricli/core';
import type { LocalContext } from '../../context.ts';
import { loginCommand } from './login.ts';
import { logoutCommand } from './logout.ts';
import { statusCommand } from './status.ts';
import { tokenCommand } from './token.ts';
import { whoamiCommand } from './whoami.ts';

export const authRoutes = buildRouteMap<string, LocalContext>({
  docs: { brief: 'Authenticate and inspect the current session' },
  routes: {
    login: loginCommand,
    logout: logoutCommand,
    status: statusCommand,
    token: tokenCommand,
    whoami: whoamiCommand,
  },
});
