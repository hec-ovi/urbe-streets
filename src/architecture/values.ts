import { unsupportedArchitecture } from '../errors.ts';
import { area } from '../geometry/polygons.ts';
import type { Ring, Vec2 } from '../geometry/schema.ts';
export type RecordValue = Record<string, unknown>;
export function bad(path: string, message: string): never { throw unsupportedArchitecture(message, { path }); }
export const object = (v: unknown, path: string): RecordValue => v !== null && typeof v === 'object' && !Array.isArray(v) ? v as RecordValue : bad(path, 'Expected an object');
export const array = (v: unknown, path: string): unknown[] => Array.isArray(v) ? v : bad(path, 'Expected an array');
export const string = (v: unknown, path: string): string => typeof v === 'string' && v.length > 0 ? v : bad(path, 'Expected a nonempty identity');
export const number = (v: unknown, path: string): number => typeof v === 'number' && Number.isFinite(v) ? v : bad(path, 'Expected a finite number');
export const integer = (v: unknown, path: string): number => Number.isSafeInteger(v) ? v as number : bad(path, 'Expected an integer');
export function point(v: unknown, path: string): Vec2 {
  const a = array(v, path); if (a.length !== 2) bad(path, 'Expected an XZ point');
  return [number(a[0], path), number(a[1], path)];
}
export function path(v: unknown, field: string): Ring {
  const points = array(v, field).map((p, i) => point(p, `${field}[${i}]`));
  if (points.length < 2) bad(field, 'Expected at least two authored points');
  return points;
}
export function ring(v: unknown, field: string): Ring {
  const points = path(v, field);
  if (points.length < 3 || area(points) <= 0) bad(field, 'Expected a positive CCW owner polygon');
  return points;
}
export const strings = (v: unknown, field: string): string[] => array(v, field).map((s, i) => string(s, `${field}[${i}]`));
export function records(v: unknown, field: string): RecordValue[] { return array(v, field).map((r, i) => object(r, `${field}[${i}]`)); }
export function indexed(rows: RecordValue[], field: string, key = 'id'): Map<string, RecordValue> {
  const out = new Map<string, RecordValue>();
  for (const row of rows) { const id = string(row[key], `${field}.${key}`); if (out.has(id)) bad(field, `Duplicate identity ${id}`); out.set(id, row); }
  return out;
}
