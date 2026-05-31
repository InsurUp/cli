import pkg from '../package.json' with { type: 'json' };

/** The CLI version, sourced from package.json so it never drifts. */
export const VERSION: string = pkg.version;
