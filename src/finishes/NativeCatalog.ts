import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {invalidParams} from '../errors.ts';
import type {NativeMaterialCatalog} from '../schema/native-materials.ts';
const record=(v:unknown):v is Record<string,unknown>=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const pair=(v:unknown)=>Array.isArray(v)&&v.length===2&&v.every(n=>typeof n==='number'&&Number.isFinite(n));
const revision='ac7c2fc02095b47d0a8fd7fda535e4ea7ce6452e';
const effects=new Set(['asphalt','photographed','polished','mineral','metal-panel','hardware','cast-concrete','parking','road-paint','decal','solid','display']);

/** Retains a renderer-neutral snapshot and validates every geometry-facing reference. */
export class NativeCatalog {
  readonly binding:NativeMaterialCatalog;
  readonly hash:string;
  private constructor(binding:NativeMaterialCatalog){this.binding=binding;this.hash=createHash('sha256').update(JSON.stringify(binding)).digest('hex');}
  static async load(source:unknown):Promise<NativeCatalog>{
    let input=source;
    if(typeof source==='string')try{input=JSON.parse(await readFile(source,'utf8'));}catch{throw invalidParams('nativeMaterials: cannot read native binding JSON');}
    if(!record(input)||input.version!==1||!record(input.source)||input.source.project!=='threejsscene'||input.source.revision!==revision||input.source.manifest!=='sources/streets/scene-native/manifest.json'
      ||!record(input.sampling)||!record(input.sampling.asphalt)||!record(input.textures)||!record(input.surfaces))throw invalidParams('nativeMaterials: source-native version 1 binding is required');
    for(const [id,texture] of Object.entries(input.textures)){
      if(!record(texture)||typeof texture.path!=='string'||!/^themes\/[a-z0-9_-]+\/assets\/(?:[a-z0-9_-]+\/)*[a-z0-9_-]+\.png$/.test(texture.path)
        ||typeof texture.sha256!=='string'||!/^[a-f0-9]{64}$/.test(texture.sha256)||!pair(texture.resolution)||(texture.resolution as number[]).some(n=>!Number.isInteger(n)||n<=0)
        ||!['srgb','linear'].includes(String(texture.colorSpace))||!Array.isArray(texture.wrap)||texture.wrap.length!==2||texture.wrap.some(v=>!['repeat','clamp'].includes(String(v))))throw invalidParams('nativeMaterials: invalid published texture',{textureId:id});
    }
    for(const [id,surface] of Object.entries(input.surfaces)){
      if(!record(surface)||!effects.has(String(surface.effect))||!record(surface.maps)||!record(surface.uv)||!['world-xz','panel','metres','curb-band','paint'].includes(String(surface.uv.mode))
        ||(surface.uv.scale!==undefined&&!pair(surface.uv.scale))||!record(surface.parameters))throw invalidParams('nativeMaterials: unsupported native surface',{surfaceId:id});
      for(const texture of Object.values(surface.maps))if(typeof texture!=='string'||!input.textures[texture])throw invalidParams('nativeMaterials: surface texture is unavailable',{surfaceId:id,textureId:texture});
      for(const value of Object.values(surface.parameters))if(!(typeof value==='boolean'||typeof value==='string'||typeof value==='number'&&Number.isFinite(value)||Array.isArray(value)&&value.every(n=>typeof n==='number'&&Number.isFinite(n))))throw invalidParams('nativeMaterials: invalid effect parameter',{surfaceId:id});
    }
    return new NativeCatalog(JSON.parse(JSON.stringify(input)) as NativeMaterialCatalog);
  }
  require(surface:string):void {if(!Object.hasOwn(this.binding.surfaces,surface))throw invalidParams('nativeMaterials: constructed surface is unavailable',{surfaceId:surface});}
}
