import { buildApplication, buildRouteMap } from '@stricli/core';
import { agentBranchRoutes } from './commands/agentBranches.ts';
import { agentRoleRoutes } from './commands/agentRoles.ts';
import { agentSetupRoutes } from './commands/agentSetup.ts';
import { agentRoutes } from './commands/agents.ts';
import { agentUserRoutes } from './commands/agentUsers.ts';
import { authRoutes } from './commands/auth/index.ts';
import { caseRoutes } from './commands/cases.ts';
import { configRoutes } from './commands/config.ts';
import { coverageRoutes } from './commands/coverage.ts';
import { customerRoutes } from './commands/customers.ts';
import { fileRoutes } from './commands/files.ts';
import { insuranceRoutes } from './commands/insurance.ts';
import { languageRoutes } from './commands/languages.ts';
import { oauthClientRoutes } from './commands/oauthClients.ts';
import { pingCommand } from './commands/ping.ts';
import { pluginRoutes } from './commands/plugins.ts';
import { policyRoutes } from './commands/policies.ts';
import { propertyRoutes } from './commands/properties.ts';
import { proposalRoutes } from './commands/proposals.ts';
import { templateRoutes } from './commands/templates.ts';
import { vehicleRoutes } from './commands/vehicles.ts';
import { webhookRoutes } from './commands/webhooks.ts';
import type { LocalContext } from './context.ts';
import { VERSION } from './version.ts';

const root = buildRouteMap<string, LocalContext>({
  docs: {
    brief: 'InsurUp CLI — manage the InsurUp insurance platform from the terminal',
  },
  routes: {
    auth: authRoutes,
    config: configRoutes,
    customers: customerRoutes,
    vehicles: vehicleRoutes,
    properties: propertyRoutes,
    policies: policyRoutes,
    proposals: proposalRoutes,
    cases: caseRoutes,
    agents: agentRoutes,
    'agent-branches': agentBranchRoutes,
    'agent-roles': agentRoleRoutes,
    'agent-setup': agentSetupRoutes,
    'agent-users': agentUserRoutes,
    'oauth-clients': oauthClientRoutes,
    insurance: insuranceRoutes,
    coverage: coverageRoutes,
    templates: templateRoutes,
    languages: languageRoutes,
    files: fileRoutes,
    webhooks: webhookRoutes,
    plugins: pluginRoutes,
    ping: pingCommand,
  },
});

export const app = buildApplication(root, {
  name: 'insurup',
  versionInfo: { currentVersion: VERSION },
  // camelCase flag keys are entered as kebab-case (`--client-id`, `--auth-server`).
  scanner: { caseStyle: 'allow-kebab-for-camel' },
});
