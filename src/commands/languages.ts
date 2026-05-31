import { buildRouteMap } from '@stricli/core';
import type { LocalContext } from '../context.ts';
import { cmd0 } from './_factory.ts';
import { take } from './_shared.ts';

const list = cmd0('List available languages', {}, ({ client }) =>
  take(client.languages.getLanguages()),
);

export const languageRoutes = buildRouteMap<string, LocalContext>({
  docs: { brief: 'Available languages' },
  routes: { list },
});
