/** Read subset of Materials' theme-index and material-entry schemas. */
export interface MaterialEntry {
  key: string;
  alignment: 'tile' | 'exact';
  tiling?: { worldSize: [number, number] };
  aspect?: [number, number];
  physical: {
    metallicFactor?: number;
    roughnessFactor?: number;
    alphaMode?: 'OPAQUE' | 'MASK' | 'BLEND';
  };
  variants: {
    id: string;
    resolution: [number, number];
    maps: { basecolor: string; normal: string; roughness: string; metallic: string; [map: string]: string };
  }[];
}
export interface MaterialCatalog { theme: string; entries: Record<string, MaterialEntry> }
export interface MaterialBinding {
  key: string;
  variant: string;
  alignment: 'tile' | 'exact';
  worldSize: [number, number];
  maps: Record<string, string>;
  physical: MaterialEntry['physical'];
}
