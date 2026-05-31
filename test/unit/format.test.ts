import { describe, expect, test } from 'bun:test';
import { colorsFor } from '../../src/output/colors.ts';
import { formatHuman, formatJson } from '../../src/output/format.ts';

const colors = colorsFor({ color: false });

describe('formatJson', () => {
  test('pretty-prints with 2 spaces', () => {
    expect(formatJson({ a: 1 })).toBe('{\n  "a": 1\n}');
  });
  test('serializes bigint as string', () => {
    expect(formatJson({ n: 10n })).toContain('"10"');
  });
});

describe('formatHuman', () => {
  test('renders an array of objects as key/value blocks (not a table)', () => {
    const out = formatHuman(
      [
        { id: 1, name: 'Ada' },
        { id: 2, name: 'Bob' },
      ],
      colors,
    );
    // One indexed block per item, each field on its own line (keys are padded).
    expect(out).toContain('── 1 ──');
    expect(out).toContain('── 2 ──');
    expect(out).toMatch(/id:\s+1/);
    expect(out).toMatch(/name:\s+Ada/);
    expect(out).toMatch(/id:\s+2/);
    expect(out).toMatch(/name:\s+Bob/);
    // Blocks are separated by a blank line; no shared single header row.
    expect(out).toContain('\n\n');
  });

  test('renders heterogeneous objects as separate key/value blocks', () => {
    const out = formatHuman([{ a: 1 }, { b: 2 }], colors);
    expect(out).toContain('a:');
    expect(out).toContain('b:');
    expect(out).toContain('── 2 ──');
  });

  test('renders an array of primitives as lines', () => {
    expect(formatHuman(['x', 'y'], colors)).toBe('x\ny');
  });

  test('empty array shows a placeholder', () => {
    expect(formatHuman([], colors)).toBe('(no results)');
  });

  test('renders a single object as key/value', () => {
    const out = formatHuman({ id: 'c1', active: true }, colors);
    expect(out).toContain('id:');
    expect(out).toContain('c1');
    expect(out).toContain('active:');
    expect(out).toContain('true');
  });

  test('truncates long cell values', () => {
    const long = 'x'.repeat(100);
    expect(formatHuman({ v: long }, colors)).toContain('…');
  });

  test('primitive renders as string', () => {
    expect(formatHuman(42, colors)).toBe('42');
  });

  test('null/undefined render as empty', () => {
    expect(formatHuman(null, colors)).toBe('');
    expect(formatHuman(undefined, colors)).toBe('');
  });
});
