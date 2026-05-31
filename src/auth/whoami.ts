import type { DefaultInsurUpClient } from '@insurup/sdk';
import { unwrap } from '../output/print.ts';

export interface Identity {
  /** Which "me" endpoint resolved the identity. */
  readonly kind: 'agent-user' | 'agent' | 'customer';
  readonly data: unknown;
}

/**
 * Resolve the authenticated identity by probing the SDK's "me" endpoints in
 * order (agent user → agent → customer). Throws a mapped {@link CliError} if the
 * final attempt fails (e.g. unauthenticated).
 */
export async function resolveIdentity(client: DefaultInsurUpClient): Promise<Identity> {
  const agentUser = await client.agentUsers.getMyAgentUser();
  if (agentUser.isSuccess) return { kind: 'agent-user', data: agentUser.data };

  const agent = await client.agents.getCurrentAgent();
  if (agent.isSuccess) return { kind: 'agent', data: agent.data };

  const customer = await client.customers.getCurrentCustomer();
  return { kind: 'customer', data: unwrap(customer) };
}
