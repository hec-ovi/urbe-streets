import { expect, it } from 'vitest';
import { readNativeAtlas } from '../../architecture/NativeAtlas.ts';
import { nativeBlueprint } from '../../architecture/fixtures/native.ts';
import type { NativeOwner } from '../../architecture/native-schema.ts';
import { rectangle, difference, totalArea } from '../../geometry/polygons.ts';
import { FeatureBuilder } from './FeatureBuilder.ts';

async function architecture() {
  const architecture = await readNativeAtlas(nativeBlueprint());
  const owner: NativeOwner = { id: 'block', kind: 'block', finish: null, interiors: [], excludedParcelIds: [], corners: [], parking: [], guards: [],
    frontages: [{ id: 'front', ownerId: 'block', edgeIds: ['e0'], start: [0, 0], end: [600, 0], inward: [0, 1], length: 600,
      moduleStationOffset: 0, pavedWidth: 6, roadTop: 0, pavedTop: 0.2, curbWidth: 0.2, gutterWidth: 0.3, cornerIds: [null, null] }],
    ground: (['gutter', 'curb', 'sidewalk'] as const).map((surface, sourceIndex) => ({ id: `g${sourceIndex}`, sourceIndex,
      ownerId: 'block', surface, ring: rectangle(0, [0, 0.3, 0.5][sourceIndex]!, 600, [0.3, 0.2, 6][sourceIndex]!), bottom: 0, top: surface === 'gutter' ? 0 : 0.2 })) };
  architecture.owners[0]!.ground[0]!.ring = rectangle(0, -7, 600, 7);
  architecture.owners.push(owner);
  architecture.shafts.push({ id: 'shaft', stationId: 'station', ring: rectangle(150, 0, 50, 6.5) });
  return architecture;
}

it('fits source features with stable bounds, exact openings and protected station space', async () => {
  const source = await architecture(), builder = new FeatureBuilder(source, 42, () => 0.7);
  try {
    const plan = builder.plan();
    expect(new Set(plan.map(feature => feature.descriptor.kind))).toEqual(new Set(['guard', 'inlet', 'channel']));
    expect(builder.plan()).toEqual(plan);
    const owner = source.owners[1]!, output = builder.draw(owner, plan);
    expect(output.coverage.length).toBe(plan.filter(feature => feature.cut).length);
    for (const feature of plan) {
      expect(totalArea(difference([feature.descriptor.footprint], owner.ground.map(ground => ground.ring)))).toBeLessThan(1e-7);
      const drawn = builder.draw(owner, [feature]);
      for (const mesh of drawn.meshes) for (let i = 0; i < mesh.positions.length; i++) {
        expect(mesh.positions[i]!).toBeGreaterThanOrEqual(feature.descriptor.bounds.min[i % 3]!);
        expect(mesh.positions[i]!).toBeLessThanOrEqual(feature.descriptor.bounds.max[i % 3]!);
      }
      expect(feature.descriptor.footprint.every(point => point[0] < 150 || point[0] > 200)).toBe(true);
      expect(drawn.meshes.every(mesh => mesh.collision && mesh.wear.every(wear => wear === 0.7))).toBe(true);
    }
  } finally { builder.dispose(); }
});

it('fails a retained guard whose source geometry conflicts with a protected shaft', async () => {
  const source = await architecture();
  source.owners[1]!.guards.push({ moduleId: 'guard', ownerId: 'block', origin: [160, 0.5], turn: 0, count: 1, step: 2 });
  const builder = new FeatureBuilder(source, 42, () => 0);
  try { expect(() => builder.plan()).toThrowError(expect.objectContaining({ code: 'E_INVARIANT' })); }
  finally { builder.dispose(); }
});

it('publishes a whole transverse source access plate with road identity',async()=>{
  const source=await readNativeAtlas(nativeBlueprint()),road=source.roads[0]!;
  road.width=14;road.path=[[0,0],[100,0]];road.lanes=Array.from({length:4},()=>road.lanes[0]!);
  source.owners[0]!.ground[0]!.ring=rectangle(0,-10,100,20);
  source.approaches=[{id:'approach',edgeId:road.id,nodeId:road.from,distance:21.5,station:[20,23],field:rectangle(20,-7,3,14),landings:[]}];
  const builder=new FeatureBuilder(source,2,()=>0);
  try{const plan=builder.plan();expect(plan).toHaveLength(1);expect(plan[0]!.descriptor).toMatchObject({kind:'access',frontageId:null,roadId:road.id,length:14.6,depth:0.6});
    expect(builder.draw(source.owners[0]!,plan).coverage).toEqual([]);
    expect(plan[0]!.descriptor.bounds.min[1]).toBeLessThan(0);
  }finally{builder.dispose();}
});
