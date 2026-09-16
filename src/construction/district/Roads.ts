import type { NativeArchitecture, NativeOwner, NativeRoad } from '../../architecture/native-schema.ts';
import type { Ring, Vec2 } from '../../geometry/schema.ts';
import { bounds, rectangle } from '../../geometry/polygons.ts';
import { difference, intersection, totalArea } from '../surfaces/Regions.ts';
import { direction, distance } from '../surfaces/Frame.ts';
import { SurfaceBatch } from '../surfaces/SurfaceBatch.ts';
import { palette } from './Palette.ts';

interface RoadFinish { ring: Ring; surface: string }

/** Roads meet a shared junction finish; all receiving masks remain Atlas-owned. */
export class DistrictRoads {
  private readonly architecture: NativeArchitecture;
  private readonly roads: RoadFinish[];
  private readonly junctions: RoadFinish[];

  constructor(architecture: NativeArchitecture) {
    this.architecture = architecture;
    this.roads = architecture.roads.filter(road => road.kind !== 'highway').map(road => ({ ring: this.road(road),
      surface: road.districtStyle === 'luxury' ? 'district-hex' : 'asphalt' }));
    this.junctions = [];
    for (const nodeId of new Set(architecture.approaches.map(approach => approach.nodeId))) {
      const approaches = architecture.approaches.filter(approach => approach.nodeId === nodeId);
      if (approaches.length !== 4) continue;
      const incident = approaches.map(approach => architecture.roads.find(road => road.id === approach.edgeId)!);
      const points = approaches.flatMap(approach => {
        const road = architecture.roads.find(road => road.id === approach.edgeId)!;
        const d = direction(road.path[0]!, road.path.at(-1)!), n: Vec2 = [-d[1], d[0]];
        const station = road.from === nodeId ? approach.station[0] : approach.station[1];
        return [-1, 1].map(side => [road.path[0]![0] + d[0] * station + n[0] * side * road.width / 2,
          road.path[0]![1] + d[1] * station + n[1] * side * road.width / 2] as Vec2);
      });
      const box = bounds(points), luxury = incident.filter(road => road.districtStyle === 'luxury').length;
      const industrial = incident.filter(road => road.districtStyle === 'industrial').length;
      if (!luxury && !industrial) continue;
      this.junctions.push({ ring: rectangle(box.min[0], box.min[1], box.max[0] - box.min[0], box.max[1] - box.min[1]),
        surface: luxury >= industrial ? 'district-junction-blue' : 'district-junction-yellow' });
    }
  }

  build(owner: NativeOwner, batch: SurfaceBatch): void {
    for (const field of owner.ground.filter(field => field.surface === 'roadway')) {
      let remaining = difference([field.ring], [...owner.parking.map(bay => bay.footprint), ...this.architecture.shafts.map(shaft => shaft.ring)]);
      for (const finish of [...this.junctions, ...this.roads]) {
        const part = intersection(remaining, [finish.ring]);
        if (totalArea(part) <= 1e-10) continue;
        this.draw(batch, finish.surface, part, field.top);
        remaining = difference(remaining, [finish.ring]);
        if (!remaining.length) break;
      }
      if (totalArea(remaining) > 1e-10) this.draw(batch, 'asphalt', remaining, field.top);
    }
    const colors = palette(owner, this.architecture);
    for (const bay of owner.parking) {
      const face = owner.frontages.find(value => value.id === bay.frontageId)!;
      this.draw(batch, colors.luxury ? 'district-hex' : 'asphalt', [bay.footprint], face.roadTop);
      if (colors.blue) {
        const d: Vec2 = [face.inward[1], -face.inward[0]], a = bay.start + 0.12, b = bay.end - 0.12;
        const at = (station: number, depth: number): Vec2 => [face.start[0] + d[0] * station + face.inward[0] * depth,
          face.start[1] + d[1] * station + face.inward[1] * depth];
        batch.polygon('district-parking-light', [[at(a, 0.01), at(b, 0.01), at(b, 0.05), at(a, 0.05)]], face.roadTop + 0.005, p => p, false);
      }
    }
  }

  private draw(batch: SurfaceBatch, surface: string, rings: Ring[], top: number): void {
    if (surface !== 'asphalt') { batch.polygon(surface, rings, top, p => p, true, true); return; }
    const box = bounds(rings.flat()), pitch = 16;
    for (let x = Math.floor(box.min[0] / pitch); x < Math.ceil(box.max[0] / pitch); x++)
      for (let z = Math.floor(box.min[1] / pitch); z < Math.ceil(box.max[1] / pitch); z++) {
        const part = intersection(rings, [rectangle(x * pitch, z * pitch, pitch, pitch)]);
        if (totalArea(part) > 1e-10) batch.polygon(surface, part, top, p => p, true, true);
      }
  }

  private road(road: NativeRoad): Ring {
    const a = road.path[0]!, d = direction(a, road.path.at(-1)!), length = distance(a, road.path.at(-1)!);
    const at = (station: number, offset: number): Vec2 => [a[0] + d[0] * station - d[1] * offset, a[1] + d[1] * station + d[0] * offset];
    return [at(0, -road.width / 2), at(length, -road.width / 2), at(length, road.width / 2), at(0, road.width / 2)];
  }
}
