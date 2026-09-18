import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {parseArgs} from 'node:util';
import {decodePiece,worldPosition} from '../src/assets/decode-fixture.ts';
import {build} from '../src/index.ts';
const {values}=parseArgs({options:{blueprint:{type:'string'},'native-materials':{type:'string'},'highway-baseline':{type:'string'}},strict:true});
assert(values.blueprint&&values['native-materials'],'Supply --blueprint and --native-materials; this conformance input must contain corners, parking, underpasses and stations.');
const bytes=await readFile(values.blueprint),blueprint=JSON.parse(bytes.toString('utf8')),hash=(value:string|Uint8Array)=>createHash('sha256').update(value).digest('hex');
const dir=await mkdtemp(join(tmpdir(),'streets-city-')),started=performance.now();
try{
  const output=await build({blueprint:values.blueprint,seed:42,design:{version:'native-1.0.0',wear:1}},{nativeMaterials:values['native-materials'],outDir:join(dir,'bundle')});
  assert.equal(output.meta.blueprintHash,hash(bytes));assert.equal(output.delegated.highways.hash,hash(JSON.stringify(blueprint.streets.highwayStructures)));
  if(values['highway-baseline']){const baseline=JSON.parse(await readFile(values['highway-baseline'],'utf8'));assert.deepEqual(blueprint.streets.highwayStructures,baseline.streets.highwayStructures);}
  const reservations=blueprint.streets.construction.reservations;
  assert(reservations.frontages.length&&reservations.corners.length&&reservations.parking.length,'Real city must exercise straight, corner and native parking fields.');
  assert(output.protected.some(record=>record.kind==='underpass')&&output.protected.some(record=>record.kind==='station-shaft'),'Real city must exercise both protected receiving areas.');
  assert.deepEqual(output.ground.replacements.groundIndices,reservations.owners.flatMap((owner:{groundIndices:number[]})=>owner.groundIndices).sort((a:number,b:number)=>a-b));
  for(const owner of output.ground.owners)assert.deepEqual(owner.polygon,blueprint.volumetric.ground[owner.sourceIndex].polygon);
  assert.deepEqual(new Set(output.features.filter(feature=>feature.kind!=='access').map(feature=>feature.kind)),new Set(['guard','inlet','channel']));
  let triangles=0;
  for(const piece of output.pieces){
    assert(piece.asset&&piece.sha256);const glb=await readFile(join(dir,'bundle',piece.asset));assert.equal(hash(glb),piece.sha256);
    const document=await decodePiece(glb);assert.equal(document.getRoot().listTextures().length,0);
    for(const node of document.getRoot().listScenes()[0]!.listChildren())assert.deepEqual(node.getTranslation(),piece.origin);
    for(const node of document.getRoot().listNodes().filter(node=>node.getMesh())){
      for(const primitive of node.getMesh()!.listPrimitives()){
        const surface=primitive.getMaterial()!.getExtras().streetNativeSurface;assert(typeof surface==='string'&&piece.surfaceIds.includes(surface));
        const effect=output.materials.binding.surfaces[surface]!.effect,collision=primitive.getExtras().streetCollision;
        assert.equal(collision,node.getExtras().streetCollision);if(['road-paint','decal'].includes(effect))assert.equal(collision,false);
        const positions=primitive.getAttribute('POSITION')!,count=positions.getCount();triangles+=primitive.getIndices()!.getCount()/3;
        for(const semantic of ['NORMAL','TEXCOORD_0','_STREET_WEAR','_STREET_HEIGHT']){const attribute=primitive.getAttribute(semantic);assert(attribute&&attribute.getCount()===count);assert([...attribute.getArray()!].every(Number.isFinite));}
        for(let i=0;i<count;i++){
          const p=worldPosition(node,primitive,i);for(let axis=0;axis<3;axis++){const precision=0.001+Math.abs(p[axis]!-piece.origin[axis]!)*2**-23;assert(p[axis]!>=piece.bounds.min[axis]!-precision&&p[axis]!<=piece.bounds.max[axis]!+precision);}
          const wear=primitive.getAttribute('_STREET_WEAR')!.getScalar(i);assert(wear>=0&&wear<=1);
        }
      }
    }
  }
  assert.equal(triangles,output.statistics.triangles);console.log(JSON.stringify({...output.statistics,blueprintHash:output.meta.blueprintHash,highwayHash:output.delegated.highways.hash,elapsedMs:Math.round(performance.now()-started)}));
}finally{await rm(dir,{recursive:true,force:true});}
