import type { Vec2, Vec3 } from '../../geometry/schema.ts';
import { along } from '../surfaces/Frame.ts';
import { SurfaceBatch } from '../surfaces/SurfaceBatch.ts';
import type { DistrictFeature } from './schema.ts';
import settings from './settings.json' with { type: 'json' };

export function marqueeGlyphs(feature: DistrictFeature, batch: SurfaceBatch, message: string): void {
  const width = Math.min(0.24, (feature.descriptor.length - 0.2) / message.length);
  const start = feature.station + (feature.descriptor.length - width * message.length) / 2;
  const depth = feature.descriptor.depth, span = Math.sqrt(1 + (0.16 / (depth - 0.04)) ** 2);
  const h = width / span, z0 = (depth - h) / 2, z1 = z0 + h;
  const at = (station: number, z: number): Vec3 => {
    const p = along(feature.face, station, feature.setback + z);
    return [p[0], feature.face.roadTop + 0.036 + 0.16 * (z - 0.02) / (depth - 0.04), p[1]];
  };
  [...message].forEach((character, column) => {
    const i = settings.glyphs.indexOf(character);
    if (i < 0 || character === ' ') return;
    const u = i % 8 / 8, v = 1 - (Math.floor(i / 8) + 1) / 6;
    const x = start + column * width;
    const uv: Vec2[] = [[u, v], [u, v + 1 / 6], [u + 1 / 8, v + 1 / 6], [u + 1 / 8, v]];
    batch.face('district-marquee', [at(x, z0), at(x, z1), at(x + width, z1), at(x + width, z0)], uv, false);
  });
}
