import { buildRouteMap } from '@stricli/core';
import type { LocalContext } from '../context.ts';
import { printSuccess } from '../output/print.ts';
import { cmd0, cmd1 } from './_factory.ts';
import { type DataFlags, dataFlag, readData, take } from './_shared.ts';

const me = cmd0('Get the current agent user', {}, ({ client }) =>
  take(client.agentUsers.getMyAgentUser()),
);
const robotCode = cmd0('Get the current agent user’s robot code', {}, ({ client }) =>
  take(client.agentUsers.getMyAgentUserRobotCode()),
);
const get = cmd1('Get an agent user by id', 'Agent user id', {}, ({ client }, id) =>
  take(client.agentUsers.getAgentUserById(id)),
);
const updateMe = cmd0<DataFlags>(
  'Update the current agent user (body via --data)',
  dataFlag,
  async ({ client, ctx, flags }) => {
    await take(
      client.agentUsers.updateMyAgentUser(
        (await readData(flags)) as Parameters<typeof client.agentUsers.updateMyAgentUser>[0],
      ),
    );
    printSuccess(ctx, flags, 'Profile updated');
  },
);
const update = cmd0<DataFlags>(
  'Update an agent user (body via --data)',
  dataFlag,
  async ({ client, ctx, flags }) => {
    await take(
      client.agentUsers.updateAgentUser(
        (await readData(flags)) as Parameters<typeof client.agentUsers.updateAgentUser>[0],
      ),
    );
    printSuccess(ctx, flags, 'Agent user updated');
  },
);
const invite = cmd0<DataFlags>(
  'Invite an agent user (body via --data)',
  dataFlag,
  async ({ client, flags }) =>
    take(
      client.agentUsers.inviteAgentUser(
        (await readData(flags)) as Parameters<typeof client.agentUsers.inviteAgentUser>[0],
      ),
    ),
);
const acceptInvite = cmd0<DataFlags>(
  'Accept an agent user invite (body via --data)',
  dataFlag,
  async ({ client, ctx, flags }) => {
    await take(
      client.agentUsers.acceptAgentUserInvite(
        (await readData(flags)) as Parameters<typeof client.agentUsers.acceptAgentUserInvite>[0],
      ),
    );
    printSuccess(ctx, flags, 'Invite accepted');
  },
);
const resendInvite = cmd1(
  'Re-send an agent user invite',
  'Agent user id',
  {},
  async ({ client, ctx, flags }, id) => {
    await take(client.agentUsers.reSendInviteAgentUser(id));
    printSuccess(ctx, flags, 'Invite re-sent');
  },
);
const checkInvite = cmd1(
  'Check an agent user invite code',
  'Invite code',
  {},
  async ({ client, ctx, flags }, code) => {
    await take(client.agentUsers.checkAgentUserInviteCode(code));
    printSuccess(ctx, flags, 'Invite code is valid');
  },
);
const activate = cmd1(
  'Activate an agent user',
  'Agent user id',
  {},
  async ({ client, ctx, flags }, id) => {
    await take(client.agentUsers.activateAgentUser(id));
    printSuccess(ctx, flags, `Activated ${id}`);
  },
);
const deactivate = cmd1(
  'Deactivate an agent user',
  'Agent user id',
  {},
  async ({ client, ctx, flags }, id) => {
    await take(client.agentUsers.deactivateAgentUser(id));
    printSuccess(ctx, flags, `Deactivated ${id}`);
  },
);
const del = cmd1(
  'Delete an agent user',
  'Agent user id',
  {},
  async ({ client, ctx, flags }, id) => {
    await take(client.agentUsers.deleteAgentUser(id));
    printSuccess(ctx, flags, `Deleted ${id}`);
  },
);
const password = cmd0<DataFlags>(
  'Update an agent user password (body via --data)',
  dataFlag,
  async ({ client, ctx, flags }) => {
    await take(
      client.agentUsers.updateAgentUserPassword(
        (await readData(flags)) as Parameters<typeof client.agentUsers.updateAgentUserPassword>[0],
      ),
    );
    printSuccess(ctx, flags, 'Password updated');
  },
);

export const agentUserRoutes = buildRouteMap<string, LocalContext>({
  docs: { brief: 'Manage agent users (staff, invites, status)' },
  routes: {
    me,
    'robot-code': robotCode,
    get,
    'update-me': updateMe,
    update,
    invite,
    'accept-invite': acceptInvite,
    'resend-invite': resendInvite,
    'check-invite': checkInvite,
    activate,
    deactivate,
    delete: del,
    password,
  },
});
