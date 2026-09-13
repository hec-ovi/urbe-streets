import pkg from '../package.json' with { type: 'json' };
import { readAtlas } from './architecture/atlas.ts';
import { Catalog, digest } from './finishes/catalog.ts';
import { buildGround } from './ground/partition.ts';
import { partitionPieces } from './assets/pieces.ts';
import { encodePiece } from './assets/glb.ts';
import { Output } from './assets/output.ts';
import { validate, buildOptions } from './validate.ts';
import { StreetsError, invariant } from './errors.ts';
import type { StreetRequest, BuildOptions } from './schema/request.ts';
import type { StreetBuild, StreetManifest } from './schema/result.ts';
export { StreetsError } from './errors.ts';
export type * from './schema/request.ts';
export type * from './schema/result.ts';
export type * from './schema/materials.ts';

export async function build(request: StreetRequest, options?: BuildOptions): Promise<StreetBuild> {
  let output: Output | undefined;
  try {
    validate(request, options);
    const config = buildOptions(options), mode = config.mode ?? 'glb';
    const architecture = readAtlas(request.blueprint), catalog = await Catalog.load(config.materials, request.design, request.seed);
    const ground = buildGround(architecture);
    const construction = architecture.surfaces.map(s => {
      const material = catalog.resolve(s.role, s.sourceIds[0]!);
      return { id: s.id, sourceIds: s.sourceIds, role: s.role, material: material.key, variant: material.variant, origin: s.origin, turn: s.turn };
    });
    const manifest: StreetManifest = {
      meta: { version: '0.1.0', generatorVersion: pkg.version, architectureVersion: architecture.version, designVersion: request.design.version,
        catalogHash: catalog.hash, seed: request.seed, identity: digest([request, catalog.hash, pkg.version, mode]), units: 'meters' },
      pieces: [], ground, construction,
      textures: { mode: 'catalog-reference', reason: 'Consumers bind the supplied catalog maps by material key and variant; GLBs carry geometry and scalar material values.', catalogHash: catalog.hash, bindings: [...catalog.bindings.values()] },
      capabilities: { turnMovements: false, walkingLanes: false, modules: architecture.modules, highways: false, stations: false, furniture: false, omissions: architecture.omissions },
      statistics: { pieces: 0, triangles: 0, materials: catalog.bindings.size, groundOwners: ground.owners.length },
    };
    const assets: Record<string, Uint8Array> = {};
    if (config.outDir) output = await Output.create(config.outDir);
    for (const [id, parts] of partitionPieces(architecture.surfaces)) {
      const result = await encodePiece(id, parts, catalog);
      const asset = mode === 'glb' ? `pieces/${id.replaceAll(':', '_')}.glb` : null;
      if (asset) {
        if (output) await output.asset(asset, result.bytes);
        else assets[asset] = result.bytes;
      }
      manifest.pieces.push({ id, kind: parts.some(p => p.source.role !== 'marking' && p.source.role !== 'roadway') ? 'block-frontage' : parts.every(p => p.source.role === 'marking') ? 'crossing' : 'junction',
        sourceIds: [...new Set(parts.flatMap(p => p.source.sourceIds))], bounds: result.bounds, asset,
        groundIds: [...new Set(parts.filter(p => p.source.role !== 'marking').map(p => p.source.id))] });
      manifest.statistics.triangles += result.triangles;
    }
    manifest.statistics.pieces = manifest.pieces.length;
    await output?.finish(manifest);
    return { ...manifest, assets };
  } catch (error) {
    await output?.abort();
    if (error instanceof StreetsError) throw error;
    throw invariant('Street construction failed', { cause: error instanceof Error ? error.message : String(error) });
  }
}
