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

/** Format an array of objects as an aligned text table. */
function formatTable(rows: ReadonlyArray<Record<string, unknown>>, colors: Colors): string {
  const columns: string[] = [];
  for (const row of rows) {
    for (const key of Object.keys(row)) {
      if (!columns.includes(key)) columns.push(key);
    }
  }
  if (columns.length === 0) return `${rows.length} item(s)`;

  const widths = columns.map((col) =>
    Math.max(col.length, ...rows.map((r) => cell(r[col]).length)),
  );
  const renderRow = (values: string[]) => values.map((v, i) => v.padEnd(widths[i] ?? 0)).join('  ');

  const header = colors.bold(renderRow(columns));
  const separator = colors.dim(widths.map((w) => '─'.repeat(w)).join('  '));
  const body = rows.map((r) => renderRow(columns.map((c) => cell(r[c]))));
  return [header, separator, ...body].join('\n');
}

/** Format a single object as an aligned key/value block. */
function formatRecord(obj: Record<string, unknown>, colors: Colors): string {
  const keys = Object.keys(obj);
  if (keys.length === 0) return colors.dim('(empty)');
  const width = Math.max(...keys.map((k) => k.length));
  return keys.map((k) => `${colors.dim(`${k}:`.padEnd(width + 1))} ${cell(obj[k])}`).join('\n');
}

/**
 * Format a value for human consumption: arrays of objects become tables, single
 * objects become key/value blocks, primitives render as-is.
 */
export function formatHuman(value: unknown, colors: Colors): string {
  if (value === null || value === undefined) return '';
  if (Array.isArray(value)) {
    if (value.length === 0) return colors.dim('(no results)');
    if (value.every(isPlainObject)) return formatTable(value as Record<string, unknown>[], colors);
    return value.map((v) => cell(v)).join('\n');
  }
  if (isPlainObject(value)) return formatRecord(value, colors);
  return String(value);
}
