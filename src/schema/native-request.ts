import type { NativeMaterialCatalog } from './native-materials.ts';
export interface NativeStreetRequest {
  /** String means a saved UTF-8 JSON path; other values are validated parsed blueprints. */
  blueprint: unknown;
  seed: number;
  design: { version: 'native-1.0.0'; wear: number };
}
export interface NativeBuildOptions {
  nativeMaterials: NativeMaterialCatalog | string;
  outDir?: string;
  mode?: 'glb' | 'manifest';
}
