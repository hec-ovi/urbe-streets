import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { invalidParams, unsatisfiable } from '../errors.ts';
import type { MaterialBinding, MaterialCatalog, MaterialEntry } from '../schema/materials.ts';
import type { StreetDesign, FinishRole } from '../schema/request.ts';

export const digest = (value: unknown): string => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const pick = (seed: number, key: string, count: number): number => parseInt(digest([seed, key]).slice(0, 8), 16) % count;
const positivePair = (v: unknown): v is [number, number] => Array.isArray(v) && v.length === 2 && v.every(n => typeof n === 'number' && Number.isFinite(n) && n > 0);
const record = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v);
const pathPattern = /^assets\/[a-z0-9_/-]+\.png$/;

export class Catalog {
  readonly hash: string;
  private readonly catalog: MaterialCatalog;
  private readonly design: StreetDesign;
  private readonly seed: number;
  readonly bindings = new Map<string, MaterialBinding>();
  private constructor(catalog: MaterialCatalog, design: StreetDesign, seed: number) {
    this.catalog = catalog; this.design = design; this.seed = seed; this.hash = digest(catalog);
  }
  static async load(source: unknown, design: StreetDesign, seed: number): Promise<Catalog> {
    let input = source;
    if (typeof source === 'string') {
      try { input = JSON.parse(await readFile(source, 'utf8')); }
      catch { throw invalidParams('materials: cannot read a theme catalog'); }
    }
    if (!record(input) || typeof input.theme !== 'string' || !record(input.entries)) throw invalidParams('materials: expected a Materials theme catalog');
    const result = new Catalog(input as unknown as MaterialCatalog, design, seed);
    for (const [role, value] of Object.entries(design.finishes)) {
      for (const key of typeof value === 'string' ? [value] : value) result.entry(key, role);
    }
    return result;
  }
  private entry(key: string, role: string): MaterialEntry {
    const e = this.catalog.entries[key];
    if (!record(e) || e.key !== key || !/^[a-z0-9_-]+\/[a-z0-9_-]+\/[a-z0-9_-]+$/.test(key)) throw invalidParams('Material key is unavailable', { key, role });
    if (!['tile', 'exact'].includes(e.alignment) || !record(e.physical) || !Array.isArray(e.variants) || !e.variants.length)
      throw invalidParams('Invalid material entry', { key, role });
    const size = e.alignment === 'tile' ? e.tiling?.worldSize : e.aspect;
    if (!positivePair(size)) throw invalidParams('Material needs its physical size or exact aspect', { key, role });
    for (const factor of ['roughnessFactor', 'metallicFactor'] as const) {
      const n = e.physical[factor];
      if (n !== undefined && (typeof n !== 'number' || !Number.isFinite(n) || n < 0 || n > 1)) throw invalidParams('Invalid material factor', { key, factor });
    }
    if (e.physical.alphaMode !== undefined && !['OPAQUE', 'BLEND', 'MASK'].includes(e.physical.alphaMode)) throw invalidParams('Invalid material alpha mode', { key });
    const ids = new Set<string>();
    for (const v of e.variants) {
      if (!record(v) || typeof v.id !== 'string' || ids.has(v.id) || !positivePair(v.resolution) || !record(v.maps)) throw invalidParams('Invalid material variant', { key });
      ids.add(v.id);
      for (const map of ['basecolor', 'normal', 'roughness', 'metallic']) if (!pathPattern.test(v.maps[map] ?? '')) throw invalidParams('Material map is unavailable', { key, variant: v.id, map });
      for (const path of Object.values(v.maps)) if (typeof path !== 'string' || !pathPattern.test(path) || path.includes('..')) throw invalidParams('Invalid material map path', { key });
    }
    return e;
  }
  resolve(role: FinishRole, owner: string): MaterialBinding {
    const family = this.design.finishes[role];
    if (!family) throw invalidParams('design.finishes: missing used role', { role, owner });
    const keys = typeof family === 'string' ? [family] : family;
    const key = keys[pick(this.seed, `${owner}:${role}`, keys.length)]!;
    const entry = this.entry(key, role), variant = entry.variants[pick(this.seed, `${owner}:${key}`, entry.variants.length)]!;
    const identity = `${key}:${variant.id}`;
    let binding = this.bindings.get(identity);
    if (!binding) {
      binding = { key, variant: variant.id, alignment: entry.alignment, worldSize: [...(entry.tiling?.worldSize ?? entry.aspect!)], physical: { ...entry.physical }, maps: { ...variant.maps } };
      this.bindings.set(identity, binding);
    }
    return binding;
  }
}

export function exactPanel(binding: MaterialBinding, width: number, depth: number, id: string): void {
  if (binding.alignment === 'exact' && Math.abs(width / depth - binding.worldSize[0] / binding.worldSize[1]) > 1e-8)
    throw unsatisfiable('Exact material aspect does not fit its panel', { id, key: binding.key, width, depth, aspect: binding.worldSize });
}
