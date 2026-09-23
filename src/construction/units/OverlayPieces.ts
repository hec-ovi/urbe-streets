import type { NativeRoad, NativeTurn } from '../../architecture/native-schema.ts';
import { rectangle } from '../../geometry/polygons.ts';
import { SurfaceBatch } from '../surfaces/SurfaceBatch.ts';
import { arrows } from '../markings/Arrows.ts';
import { Paint } from '../markings/Paint.ts';
import type { AuthoredUnit } from './KitCatalogue.ts';
import { pieceGeometry } from './PieceConstruction.ts';
import { pieceFootprint } from './PieceFootprint.ts';

export const scanAtlas = ['asphalt-damage', 'asphalt-fracture', 'asphalt-repair', 'oil-patch'];
export const turnKinds = ['through', 'left', 'right'] as const;
export const arrowId = (kinds: string[]) => `overlay/arrow/${turnKinds.filter(k => kinds.includes(k)).join('+')}`;

/** Geometry is shared; only pose, UV cells and glyph indices vary per instance. */
export function overlayPieces(): AuthoredUnit[] {
  const pieces: AuthoredUnit[] = [];
  const add = (id: string, batch: SurfaceBatch, variant: string) => {
    const geometry = pieceGeometry(id, [batch.finish()]);
    pieces.push({ geometry, metadata: { id, kind: 'overlay', classes: [], zone: 'shared', variant, length: 0,
      origin: 'anchor-at-road', footprint: pieceFootprint(geometry, false) } });
  };
  const batch = () => new SurfaceBatch({ ownerId: 'overlay', groundIds: ['overlay'], roadTop: 0, wear: () => 0 });
  for (let mask = 1; mask < 8; mask++) {
    const kinds = turnKinds.filter((_, i) => mask & 1 << i), target = batch();
    const road: NativeRoad = { id: 'arrow', from: 'start', to: 'end', kind: 'street', width: 4, path: [[-2, 0], [2, 0]],
      runId: 'arrow', runStart: 0, runForward: true, lanes: [{ id: 'lane', offset: 0, width: 4, direction: 'forward', path: [[-2, 0], [2, 0]] }] };
    const turns: NativeTurn[] = kinds.map(kind => ({ nodeId: 'end', fromLaneId: 'lane', toLaneId: kind, kind, level: 0 }));
    arrows(new Paint(target, [rectangle(-2, -2, 4, 4)], 0), { road, start: [-2, 0], end: [2, 0], d: [1, 0], n: [0, 1], length: 4, top: 0 }, 2, 'end', turns);
    add(arrowId(kinds), target, 'arrow');
  }
  for (const depth of [0.5, 0.7]) {
    const target = batch(), gutter = depth - 0.2;
    // Source inlets sit below the gutter, so their overlay draws the grate and curb mouth; district
    // inlets carry their own flush grate and curb throats and keep only the tread hatch here.
    if (depth === 0.5) {
      target.polygon('darkMetal', [rectangle(-1, 0, 2, gutter)], ([, z]) => 0.003 + z / gutter * 0.06, p => p, false);
      for (let x = -0.94; x < 0.95; x += 0.065) target.polygon('metal', [rectangle(x, 0.04, 0.035, gutter - 0.08)], ([, z]) => 0.005 + z / gutter * 0.06, p => p, false);
      target.face('darkMetal', [[-0.9, 0.061, gutter - 0.002], [0.9, 0.061, gutter - 0.002], [0.9, 0.13, gutter - 0.002], [-0.9, 0.13, gutter - 0.002]], [[0, 0], [1, 0], [1, 1], [0, 1]], false);
      for (let x = -0.74; x < 0.85; x += 0.16) target.face('metal',
        [[x - 0.015, 0.061, gutter - 0.004], [x + 0.015, 0.061, gutter - 0.004], [x + 0.015, 0.13, gutter - 0.004], [x - 0.015, 0.13, gutter - 0.004]],
        [[0, 0], [1, 0], [1, 1], [0, 1]], false);
    }
    // The tread surface is a panel scan: one 0..1 UV square over the 2 x 2 m hatch.
    target.polygon('tread', [rectangle(-1, depth, 2, 2)], 0.201, ([x, z]) => [(x + 1) / 2, (z - depth) / 2], false);
    add(`overlay/drain/${depth}m`, target, 'drain');
  }
  const quad = batch();
  quad.polygon(scanAtlas[0]!, [rectangle(-0.5, -0.5, 1, 1)], 0, ([x, z]) => [x + 0.5, 0.5 - z], false);
  add('overlay/scan', quad, 'scan');
  return pieces;
}
