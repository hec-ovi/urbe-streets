import {it,expect} from 'vitest';
import {createHash} from 'node:crypto';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {build} from '../src/index.ts';
import {nativeBlueprint} from '../src/architecture/fixtures/native.ts';
import catalog from './fixtures/native-materials.json' with {type:'json'};
import type {NativeMaterialCatalog} from '../src/schema/native-materials.ts';
const nativeMaterials=catalog as unknown as NativeMaterialCatalog;
const request=()=>({blueprint:nativeBlueprint(),seed:42,design:{version:'native-1.0.0' as const,wear:0}});
const hash=(value:string|Uint8Array)=>createHash('sha256').update(value).digest('hex');
it('accepts Atlas 0.26.0 with planning reservations 2.1.0 and rejects older versions',async()=>{
  const input=request();const a=await build(input,{nativeMaterials}),b=await build(input,{nativeMaterials});expect(a).toEqual(b);
  expect(a.meta).toMatchObject({version:'0.2.0',architectureVersion:'0.26.0',reservationVersion:'2.1.0',blueprintEncoding:'json-stringify-utf8',blueprintHash:hash(JSON.stringify(input.blueprint)),nativeCatalogHash:hash(JSON.stringify(catalog))});
  expect(a.ground.replacements).toEqual({groundIndices:[0],moduleOwnerIds:['roadway']});expect(a.ground.cover.missingArea).toBe(0);
  for(const piece of a.pieces){expect(piece.sha256).toBe(hash(a.assets[piece.asset!]!));expect(piece.hasCollision).toBe(true);}
  const manifest=await build(input,{nativeMaterials,mode:'manifest'});expect(manifest.assets).toEqual({});expect(manifest.pieces.every(piece=>piece.asset===null&&piece.sha256===null)).toBe(true);
  input.blueprint.meta.version='0.24.0';
  await expect(build(input,{nativeMaterials})).rejects.toMatchObject({code:'E_UNSUPPORTED_ARCHITECTURE',details:{path:'meta.version'}});
  input.blueprint.meta.version='0.26.0';input.blueprint.streets.construction.planningReservations.version='1.0.0';
  await expect(build(input,{nativeMaterials})).rejects.toMatchObject({code:'E_UNSUPPORTED_ARCHITECTURE',details:{path:'streets.construction.planningReservations.version'}});
});
it('hashes exact saved blueprint bytes and publishes the disk manifest after its assets',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'streets-native-'));
  try{const blueprint=join(dir,'blueprint.json'),bytes=JSON.stringify(nativeBlueprint(),null,2)+'\n';await writeFile(blueprint,bytes);
    const output=await build({...request(),blueprint},{nativeMaterials,outDir:join(dir,'bundle')});
    expect(output.meta.blueprintHash).toBe(hash(bytes));expect(output.meta.blueprintEncoding).toBe('json-file-bytes');expect(output.assets).toEqual({});
    const saved=JSON.parse(await readFile(join(dir,'bundle','manifest.json'),'utf8'));const {assets,...manifest}=output;expect(saved).toEqual(manifest);
    for(const piece of output.pieces)expect(hash(await readFile(join(dir,'bundle',piece.asset!)))).toBe(piece.sha256);
    await expect(build({...request(),blueprint},{nativeMaterials,outDir:join(dir,'bundle')})).rejects.toMatchObject({code:'E_INVALID_PARAMS'});
  }finally{await rm(dir,{recursive:true,force:true});}
});
it('publishes the same city whether owners are built in this thread or in the worker pool',async()=>{
  const input=request();
  const previous=process.env.STREETS_WORKERS;
  try{
    process.env.STREETS_WORKERS='0';const local=await build(input,{nativeMaterials});
    process.env.STREETS_WORKERS='2';const pooled=await build(input,{nativeMaterials});
    expect(pooled).toEqual(local);expect(pooled.statistics.triangles).toBeGreaterThan(0);
  }finally{if(previous===undefined)delete process.env.STREETS_WORKERS;else process.env.STREETS_WORKERS=previous;}
});
it('rejects malformed native requests',async()=>{
  await expect(build({...request(),seed:NaN},{nativeMaterials})).rejects.toMatchObject({code:'E_INVALID_PARAMS'});
});
