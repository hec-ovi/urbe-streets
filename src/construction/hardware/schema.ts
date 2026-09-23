import type { BufferGeometry } from 'three';
export type HardwareSurface = 'metal' | 'darkMetal' | 'ochre' | 'green' | 'plastic' | 'concrete' | 'paintedConcrete' | 'perforated'
  | 'marquee-channel' | 'marquee-frame' | 'marquee-lip' | 'marquee-cap' | 'marquee-led';
export type FurnitureMaterials = Record<HardwareSurface, never>;
export interface FurnitureOptions {
  kind: 'guard' | 'inlet' | 'channel' | 'access' | 'cable' | 'marquee' | 'marquee-cap' | 'tree-grate';
  length: number;
  depth: number;
  style: number;
  damaged: boolean;
}
export interface FurniturePart { geometry: BufferGeometry; material: HardwareSurface }
export interface FurnitureModel { parts: FurniturePart[]; dispose(): void }
