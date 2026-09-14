export interface NativeTexture {
  path: string; resolution: [number, number]; sha256: string; colorSpace: 'srgb' | 'linear'; wrap: ['repeat' | 'clamp', 'repeat' | 'clamp'];
}
export interface NativeSurface {
  effect: string; maps: Record<string, string>;
  uv: { mode: 'world-xz' | 'panel' | 'metres' | 'curb-band' | 'paint'; scale?: [number, number] };
  parameters: Record<string, number | boolean | string | number[]>;
}
/** Unmodified renderer-neutral binding snapshot from Materials. No image bytes. */
export interface NativeMaterialCatalog {
  version: 1;
  source: { project: 'threejsscene'; revision: string; manifest: string };
  sampling: { asphalt: Record<string, string | number | number[]> };
  textures: Record<string, NativeTexture>;
  surfaces: Record<string, NativeSurface>;
}
