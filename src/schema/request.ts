import type { MaterialCatalog } from './materials.ts';

export type FinishRole = 'roadway' | 'panel' | 'joint' | 'curb' | 'gutter' | 'gutter-lip' | 'guardrail' | 'marking';
/** Every used role needs a Materials key. An array gives seed-selectable finish families. */
export interface StreetDesign {
  version: string;
  finishes: Partial<Record<FinishRole, string | string[]>>;
}
export interface StreetRequest {
  /** Saved Atlas CityBlueprint 0.21.0, read by architecture/atlas.ts only. */
  blueprint: unknown;
  design: StreetDesign;
  seed: number;
}
export interface BuildOptions {
  /** A saved theme.json path or its parsed catalog. Required, no implicit sibling path. */
  materials: MaterialCatalog | string;
  /** Omit for an in-memory result. Existing destinations are rejected. */
  outDir?: string;
  /** glb includes model bytes; manifest emits no assets or asset references. Default glb. */
  mode?: 'glb' | 'manifest';
}
