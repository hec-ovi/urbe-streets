import {expect,it} from 'vitest';
import {readNativeAtlas} from '../architecture/NativeAtlas.ts';
import {nativeBlueprint} from '../architecture/fixtures/native.ts';
import {rectangle} from '../geometry/polygons.ts';
import {NativeCoverage} from './NativeCoverage.ts';
it('publishes exact replacement indices and rejects missing land and parcel encroachment',async()=>{
  const a=await readNativeAtlas(nativeBlueprint()),owner=a.owners[0]!,coverage=new NativeCoverage(a),claim={ownerId:owner.id,rings:owner.ground.map(ground=>ground.ring)};
  coverage.add(owner,[claim]);expect(coverage.finish().replacements).toEqual({groundIndices:[0],moduleOwnerIds:['roadway']});
  expect(()=>new NativeCoverage(a).add(owner,[])).toThrowError(expect.objectContaining({code:'E_INVARIANT'}));
  a.exclusions.push(rectangle(5,5,1,1));expect(()=>new NativeCoverage(a).add(owner,[claim])).toThrowError(expect.objectContaining({code:'E_UNSATISFIABLE'}));
});
