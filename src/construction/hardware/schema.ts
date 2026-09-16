import type { BufferGeometry } from 'three';
export type HardwareSurface = 'metal' | 'darkMetal' | 'ochre' | 'green' | 'plastic' | 'concrete' | 'paintedConcrete' | 'perforated';
export type FurnitureMaterials = Record<HardwareSurface, never>;
export interface FurnitureOptions {
  kind: 'guard' | 'inlet' | 'channel' | 'access' | 'cable' | 'marquee' | 'tree-grate';
  length: number;
  depth: number;
  style: number;
  damaged: boolean;
}
export interface FurniturePart { geometry: BufferGeometry; material: HardwareSurface }
export interface FurnitureModel { parts: FurniturePart[]; dispose(): void }
