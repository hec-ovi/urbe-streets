import { expect, it } from 'vitest';
import { WearField } from './WearField.ts';
import { PanelStyle } from './PanelStyle.ts';
import reference from './source-style.json' with { type: 'json' };
import type { Vec2 } from '../../geometry/schema.ts';

const vec = (p: number[]): Vec2 => [p[0]!, p[1]!];
const bounds = { min: vec(reference.bounds.min), max: vec(reference.bounds.max) };

it('matches original generated district zones, source samples, rows and palettes', () => {
  const field = new WearField({ seed: 42, streets: 13, amount: 1, bounds: bounds });
  expect(field.snapshot().zones).toEqual(reference.zones);
  for (const sample of reference.samples) expect(field.sample(vec(sample.point))).toBe(sample.value);
  for (const row of reference.rows) {
    const rows = PanelStyle.rows(row.width, 42, row.key);
    expect(rows).toEqual(row.value);
    expect(rows.reduce((sum, value) => sum + value.width, 0)).toBe(row.width);
  }
  for (const palette of reference.palettes) expect(PanelStyle.palette(42, palette.id, palette.wear)).toEqual(palette.value);
  const half = new WearField({ seed: 42, streets: 13, amount: 0.5, bounds: bounds });
  expect(half.sample(vec(reference.samples[1]!.point))).toBe(reference.samples[1]!.value / 2);
  const saved = field.snapshot(); saved.zones[0]!.strength = 0;
  expect(field.snapshot().zones).toEqual(reference.zones);
});

it('rejects unsupported style dimensions and invalid field parameters', () => {
  expect(() => PanelStyle.rows(3.25, 42, 'face')).toThrowError(expect.objectContaining({ code: 'E_INVALID_PARAMS' }));
  expect(() => new WearField({ seed: 42, streets: 0, amount: 1, bounds: bounds }))
    .toThrowError(expect.objectContaining({ code: 'E_INVALID_PARAMS' }));
  expect(() => PanelStyle.palette(42, 'owner', 2)).toThrowError(expect.objectContaining({ code: 'E_INVALID_PARAMS' }));
});
