import type { Colors } from './colors.ts';

/** Pretty-print any value as JSON (2-space indent), tolerating bigint. */
export function formatJson(value: unknown): string {
  return JSON.stringify(value, (_k, v) => (typeof v === 'bigint' ? v.toString() : v), 2);
}

const MAX_CELL = 48;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Render a single cell value as a compact, length-bounded string. */
function cell(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return truncate(value);
  if (typeof value === 'object') return truncate(JSON.stringify(value));
  return truncate(String(value));
}

function truncate(s: string): string {
  const flat = s.replace(/\s+/g, ' ').trim();
  return flat.length > MAX_CELL ? `${flat.slice(0, MAX_CELL - 1)}…` : flat;
}

/** Format a single object as an aligned key/value block. */
function formatRecord(obj: Record<string, unknown>, colors: Colors): string {
  const keys = Object.keys(obj);
  if (keys.length === 0) return colors.dim('(empty)');
  const width = Math.max(...keys.map((k) => k.length));
  return keys.map((k) => `${colors.dim(`${k}:`.padEnd(width + 1))} ${cell(obj[k])}`).join('\n');
}

/**
 * Format a list of items as key/value blocks, one per item, each under a dim
 * `── n ──` header and separated by a blank line. Friendlier to read than a
 * table for records with many (or wide) fields.
 */
export function formatRecords(items: ReadonlyArray<unknown>, colors: Colors): string {
  if (items.length === 0) return colors.dim('(no results)');
  return items
    .map((item, i) => {
      const header = colors.dim(`── ${i + 1} ──`);
      const body = isPlainObject(item) ? formatRecord(item, colors) : cell(item);
      return `${header}\n${body}`;
    })
    .join('\n\n');
}

/**
 * Format a value for human consumption: arrays of objects become key/value
 * blocks (one per item), single objects become a key/value block, primitives
 * render as-is.
 */
export function formatHuman(value: unknown, colors: Colors): string {
  if (value === null || value === undefined) return '';
  if (Array.isArray(value)) {
    if (value.length === 0) return colors.dim('(no results)');
    if (value.every(isPlainObject)) return formatRecords(value, colors);
    return value.map((v) => cell(v)).join('\n');
  }
  if (isPlainObject(value)) return formatRecord(value, colors);
  return String(value);
}
