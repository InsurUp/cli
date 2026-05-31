import { basename } from 'node:path';
import { buildRouteMap } from '@stricli/core';
import type { LocalContext } from '../context.ts';
import { cmd1 } from './_factory.ts';
import { take } from './_shared.ts';

const upload = cmd1('Upload a public file by path', 'File path', {}, async ({ client }, path) => {
  const bunFile = Bun.file(path);
  const fileName = basename(path);
  const file = new File([await bunFile.arrayBuffer()], fileName, { type: bunFile.type });
  return take(client.files.uploadPublicFile({}, file, fileName));
});

export const fileRoutes = buildRouteMap<string, LocalContext>({
  docs: { brief: 'Upload files' },
  routes: { upload },
});
