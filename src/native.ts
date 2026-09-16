import {createHash} from 'node:crypto';
import pkg from '../package.json' with {type:'json'};
import {readNativeAtlas} from './architecture/NativeAtlas.ts';
import {NativeCatalog} from './finishes/NativeCatalog.ts';
import {NativeCoverage} from './ground/NativeCoverage.ts';
import {NativePartition} from './assets/NativePartition.ts';
import {encodeNativePiece} from './assets/NativeGlb.ts';
import {Output} from './assets/output.ts';
import {WearField} from './construction/style/WearField.ts';
import {FeatureBuilder} from './construction/features/FeatureBuilder.ts';
import {SurfaceBatch} from './construction/surfaces/SurfaceBatch.ts';
import {EdgeRing} from './construction/surfaces/EdgeRing.ts';
import {Paving} from './construction/surfaces/Paving.ts';
import {parking} from './construction/surfaces/Parking.ts';
import {asphalt} from './construction/surfaces/Asphalt.ts';
import {Markings} from './construction/markings/Markings.ts';
import {DistrictConstruction} from './construction/district/DistrictConstruction.ts';
import {StreetsError,invalidParams,invariant} from './errors.ts';
import type {NativeStreetRequest,NativeBuildOptions} from './schema/native-request.ts';
import type {NativeStreetBuild,NativeStreetManifest} from './schema/native-result.ts';
const hash=(value:string|Uint8Array)=>createHash('sha256').update(value).digest('hex');

/** Builds from the same original bytes whose identity is published in the finished bundle. */
export async function buildNative(request:NativeStreetRequest,options:NativeBuildOptions):Promise<NativeStreetBuild>{
  let output:Output|undefined,features:FeatureBuilder|undefined,district:DistrictConstruction|undefined;
  try{
    if(!request||!Number.isInteger(request.seed)||!request.design||request.design.version!=='native-1.0.0'||!Number.isFinite(request.design.wear)||request.design.wear<0||request.design.wear>1
      ||!options||!options.nativeMaterials||options.mode!==undefined&&!['glb','manifest'].includes(options.mode)||options.outDir!==undefined&&(typeof options.outDir!=='string'||!options.outDir))throw invalidParams('Expected native-1.0.0 design, integer seed, wear 0..1 and nativeMaterials binding');
    const a=await readNativeAtlas(request.blueprint),catalog=await NativeCatalog.load(options.nativeMaterials),mode=options.mode??'glb';
    const field=new WearField({seed:request.seed,bounds:a.bounds,streets:new Set(a.roads.filter(road=>road.kind!=='highway').map(road=>road.runId)).size,amount:request.design.wear});
    const wear=(point:Parameters<WearField['sample']>[0])=>field.sample(point),partition=new NativePartition(),coverage=new NativeCoverage(a),edges=a.format==='district'?undefined:new EdgeRing(a),paving=a.format==='district'?undefined:new Paving(a,request.seed,wear),markings=new Markings(a,request.seed,wear);
    if(a.format==='district')district=new DistrictConstruction(a);else features=new FeatureBuilder(a,request.seed,wear);
    const plan=features?.plan()??[],shafts=a.shafts.map(shaft=>shaft.ring);let panels=0;
    const surfaces=new Set<string>();
    for(const owner of a.owners){
      const selected=plan.filter(feature=>feature.descriptor.ownerId===owner.id),cuts=selected.flatMap(feature=>feature.cut?[feature.cut]:[]);
      const roadTop=owner.frontages[0]?.roadTop??owner.ground.find(ground=>ground.surface==='roadway')?.top;
      if(roadTop===undefined&&owner.kind!=='station')throw invariant('Native owner has no declared road datum',{ownerId:owner.id});
      const stationTop=owner.kind==='station'?owner.ground[0]!.top-0.2:undefined;
      const batch=new SurfaceBatch({ownerId:owner.id,groundIds:owner.ground.map(ground=>ground.id),roadTop:roadTop??stationTop!,wear});
      if(district)panels+=district.build(owner,batch);
      else{asphalt(owner,batch,shafts);panels+=parking(owner,batch);edges!.build(owner,batch,cuts,shafts);panels+=paving!.build(owner,batch,cuts,shafts);}
      markings.build(owner,batch);
      const surface=batch.finish(),hardware=features?.draw(owner,selected)??{meshes:[],coverage:[]};coverage.add(owner,[...surface.coverage,...hardware.coverage]);
      for(const mesh of [...surface.meshes,...hardware.meshes]){catalog.require(mesh.surface);surfaces.add(mesh.surface);partition.add(mesh);}
    }
    const manifest:NativeStreetManifest={
      meta:{version:'0.2.0',generatorVersion:pkg.version,architectureVersion:a.version,reservationVersion:a.reservationVersion,designVersion:request.design.version,blueprintHash:a.identity.hash,blueprintEncoding:a.identity.encoding,nativeCatalogHash:catalog.hash,seed:request.seed,
        identity:hash(JSON.stringify([a.identity,catalog.hash,request.seed,request.design,pkg.version])),units:'meters'},
      pieces:[],ground:coverage.finish(),features:district?.features??plan.map(feature=>feature.descriptor),materials:{mode:'native-reference',binding:catalog.binding},wear:field.snapshot(),protected:a.protections,
      delegated:{highways:{source:'streets.highwayStructures',hash:a.highwayHash,count:a.protections.filter(protection=>protection.kind==='highway').length},stations:{source:'transit.subwayStations',hash:a.stationHash,stationIds:[...new Set([...a.stationBays.map(bay=>bay.stationId),...a.shafts.map(shaft=>shaft.stationId)])]},remainingGroundIndices:a.remainingGroundIndices},
      statistics:{pieces:0,triangles:0,materials:surfaces.size,groundOwners:a.owners.reduce((sum,owner)=>sum+owner.ground.length,0),features:district?.features.length??plan.length,panels},
    };
    const assets:Record<string,Uint8Array>={};if(options.outDir)output=await Output.create(options.outDir);
    for(const piece of partition.finish()){
      const encoded=await encodeNativePiece(piece),asset=mode==='glb'?`pieces/${piece.id.replaceAll(':','_')}.glb`:null;
      if(asset){if(output)await output.asset(asset,encoded.bytes);else assets[asset]=encoded.bytes;}
      manifest.pieces.push({id:piece.id,asset,sha256:asset?hash(encoded.bytes):null,bounds:encoded.bounds,origin:piece.origin,ownerIds:[...new Set(piece.meshes.flatMap(mesh=>mesh.ownerIds))],groundIds:[...new Set(piece.meshes.flatMap(mesh=>mesh.groundIds))],surfaceIds:[...new Set(piece.meshes.map(mesh=>mesh.surface))],hasCollision:piece.meshes.some(mesh=>mesh.collision),triangles:encoded.triangles});
      manifest.statistics.triangles+=encoded.triangles;
    }
    manifest.statistics.pieces=manifest.pieces.length;await output?.finish(manifest);return {...manifest,assets};
  }catch(error){await output?.abort();if(error instanceof StreetsError)throw error;throw invariant('Native street construction failed',{cause:error instanceof Error?error.message:String(error)});}
  finally{features?.dispose();district?.dispose();}
}
