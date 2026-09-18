import {createHash} from 'node:crypto';
import pkg from '../package.json' with {type:'json'};
import {readNativeAtlas} from './architecture/NativeAtlas.ts';
import {NativeCatalog} from './finishes/NativeCatalog.ts';
import {NativeCoverage} from './ground/NativeCoverage.ts';
import {NativePartition} from './assets/NativePartition.ts';
import {encodeNativePiece} from './assets/NativeGlb.ts';
import {Output} from './assets/output.ts';
import {OwnerConstruction} from './construction/OwnerConstruction.ts';
import {OwnerWorkers,width} from './construction/OwnerWorkers.ts';
import type {OwnerResult} from './construction/OwnerWorkers.ts';
import {StreetsError,invalidParams,invariant} from './errors.ts';
import type {NativeStreetRequest,NativeBuildOptions} from './schema/native-request.ts';
import type {NativeStreetBuild,NativeStreetManifest} from './schema/native-result.ts';
const hash=(value:string|Uint8Array)=>createHash('sha256').update(value).digest('hex');

/** Builds from the same original bytes whose identity is published in the finished bundle. */
export async function buildNative(request:NativeStreetRequest,options:NativeBuildOptions):Promise<NativeStreetBuild>{
  let output:Output|undefined,construction:OwnerConstruction|undefined,workers:OwnerWorkers|undefined,opening:Promise<OwnerWorkers>|undefined;
  try{
    if(!request||!Number.isInteger(request.seed)||!request.design||request.design.version!=='native-1.0.0'||!Number.isFinite(request.design.wear)||request.design.wear<0||request.design.wear>1
      ||!options||!options.nativeMaterials||options.mode!==undefined&&!['glb','manifest'].includes(options.mode)||options.outDir!==undefined&&(typeof options.outDir!=='string'||!options.outDir))throw invalidParams('Expected native-1.0.0 design, integer seed, wear 0..1 and nativeMaterials binding');
    const a=await readNativeAtlas(request.blueprint),catalog=await NativeCatalog.load(options.nativeMaterials),mode=options.mode??'glb';
    const partition=new NativePartition(),coverage=new NativeCoverage(a);
    const size=width(a.owners.length);
    // The pool boots off-thread while this thread builds its own copy of the shared plan.
    opening=size>1?OwnerWorkers.open(a,request.seed,request.design.wear,size):undefined;
    construction=new OwnerConstruction(a,request.seed,request.design.wear);
    workers=await opening;
    // Owners run ahead of the assembly by one pool width, so the city partitions while the pool keeps building.
    const pending:(Promise<OwnerResult>|undefined)[]=[],lead=size+2;
    const submit=(index:number)=>{if(workers&&index<a.owners.length){const job=workers.build(index);job.catch(()=>{});pending[index]=job;}};
    for(let index=0;index<lead;index++)submit(index);
    let panels=0;const surfaces=new Set<string>();
    for(const [index,owner] of a.owners.entries()){
      const built=workers?await pending[index]!:construction.build(index);pending[index]=undefined;submit(index+lead);
      panels+=built.panels;coverage.add(owner,built.coverage);
      for(const mesh of built.meshes){catalog.require(mesh.surface);surfaces.add(mesh.surface);partition.add(mesh);}
    }
    await workers?.close();workers=undefined;
    const manifest:NativeStreetManifest={
      meta:{version:'0.2.0',generatorVersion:pkg.version,architectureVersion:a.version,reservationVersion:a.reservationVersion,designVersion:request.design.version,blueprintHash:a.identity.hash,blueprintEncoding:a.identity.encoding,nativeCatalogHash:catalog.hash,seed:request.seed,
        identity:hash(JSON.stringify([a.identity,catalog.hash,request.seed,request.design,pkg.version])),units:'meters'},
      pieces:[],ground:coverage.finish(),features:construction.features,materials:{mode:'native-reference',binding:catalog.binding},wear:construction.snapshot(),protected:a.protections,
      delegated:{highways:{source:'streets.highwayStructures',hash:a.highwayHash,count:a.protections.filter(protection=>protection.kind==='highway').length},stations:{source:'transit.subwayStations',hash:a.stationHash,stationIds:[...new Set([...a.stationBays.map(bay=>bay.stationId),...a.shafts.map(shaft=>shaft.stationId)])]},remainingGroundIndices:a.remainingGroundIndices},
      statistics:{pieces:0,triangles:0,materials:surfaces.size,groundOwners:a.owners.reduce((sum,owner)=>sum+owner.ground.length,0),features:construction.features.length,panels},
    };
    const assets:Record<string,Uint8Array>={};if(options.outDir)output=await Output.create(options.outDir);
    for(const piece of partition.finish()){
      const encoded=await encodeNativePiece(piece),asset=mode==='glb'?`pieces/${piece.id.replaceAll(':','_')}.glb`:null;
      if(asset){if(output)await output.asset(asset,encoded.bytes);else assets[asset]=encoded.bytes;}
      manifest.pieces.push({id:piece.id,asset,sha256:asset?hash(encoded.bytes):null,bounds:encoded.bounds,origin:piece.origin,ownerIds:[...new Set(piece.meshes.flatMap(mesh=>mesh.ownerIds))],groundIds:[...new Set(piece.meshes.flatMap(mesh=>mesh.groundIds))],surfaceIds:[...new Set(piece.meshes.map(mesh=>mesh.surface))],hasCollision:piece.meshes.some(mesh=>mesh.collision),triangles:encoded.triangles});
      manifest.statistics.triangles+=encoded.triangles;
    }
    manifest.statistics.pieces=manifest.pieces.length;await output?.finish(manifest);return {...manifest,assets};
  }catch(error){workers??=await opening?.catch(()=>undefined);await workers?.close();await output?.abort();if(error instanceof StreetsError)throw error;throw invariant('Native street construction failed',{cause:error instanceof Error?error.message:String(error)});}
  finally{construction?.dispose();}
}
