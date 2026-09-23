import { createHash } from 'node:crypto';
import pkg from '../package.json' with { type: 'json' };
import { readNativeAtlas } from './architecture/NativeAtlas.ts';
import { NativeCatalog } from './finishes/NativeCatalog.ts';
import { scanAtlas } from './construction/units/OverlayPieces.ts';
import settings from './construction/district/settings.json' with { type: 'json' };
import { StreetUnits } from './construction/units/StreetUnits.ts';
import { encodeNativePiece } from './assets/NativeGlb.ts';
import { Output } from './assets/output.ts';
import { StreetsError, invalidParams, invariant } from './errors.ts';
import type { NativeStreetRequest, NativeBuildOptions } from './schema/native-request.ts';
import type { NativeStreetBuild, NativeStreetManifest } from './schema/native-result.ts';
import type { StreetKit, StreetPlacements } from './schema/street-kit.ts';
import type { Vec3 } from './geometry/schema.ts';
const hash = (value: string | Uint8Array) => createHash('sha256').update(value).digest('hex');

/** Builds the shared kit and its instances from the exact saved Atlas input. */
export async function buildNative(request: NativeStreetRequest, options: NativeBuildOptions): Promise<NativeStreetBuild> {
  let output: Output | undefined;
  try {
    if (!request || !Number.isInteger(request.seed) || !request.design || request.design.version !== 'native-1.0.0'
      || !Number.isFinite(request.design.wear) || request.design.wear < 0 || request.design.wear > 1
      || !options || !options.nativeMaterials || options.mode !== undefined && !['glb', 'manifest'].includes(options.mode)
      || options.outDir !== undefined && (typeof options.outDir !== 'string' || !options.outDir)) throw invalidParams('Expected native-1.0.0 design, integer seed, wear 0..1 and nativeMaterials binding');
    const a = await readNativeAtlas(request.blueprint), catalog = await NativeCatalog.load(options.nativeMaterials), mode = options.mode ?? 'glb';
    const units = new StreetUnits(a, request.seed, request.design.wear);
    const kit: StreetKit = { version: '1.2.0', units: 'meters', module: 8, profiles: units.catalogue.profiles, scanAtlas, glyphs: settings.glyphs, pieces: [] };
    const placements: StreetPlacements = { version: '1.2.0', cellSize: 128, placements: units.placements };
    const assets: Record<string, Uint8Array> = {}, surfaces = new Set<string>();
    for (const surface of scanAtlas) { catalog.require(surface); surfaces.add(surface); }
    if (options.outDir) output = await Output.create(options.outDir);
    for (const piece of units.pieces) {
      const geometry = { ...piece.geometry, meshes: piece.geometry.meshes.map(mesh => ({ ...mesh, surface: catalog.resolve(mesh.surface) })) };
      for (const mesh of geometry.meshes) surfaces.add(mesh.surface);
      const encoded = await encodeNativePiece(geometry), file = `pieces/${piece.metadata.id}.glb`;
      if (mode === 'glb') {
        const path = `streets/${file}`;
        if (output) await output.asset(path, encoded.bytes); else assets[path] = encoded.bytes;
      }
      kit.pieces.push({ ...piece.metadata, file, size: encoded.bounds.max.map((v, i) => v - encoded.bounds.min[i]!) as unknown as Vec3,
        bounds: encoded.bounds, hasCollision: geometry.meshes.some(m => m.collision), surfaces: [...new Set(geometry.meshes.map(m => m.surface))].sort(), triangles: encoded.triangles, bytes: encoded.bytes.length, sha256: hash(encoded.bytes) });
    }
    const kitBytes = new TextEncoder().encode(JSON.stringify(kit)), placementBytes = new TextEncoder().encode(JSON.stringify(placements));
    const pieceBytes = kit.pieces.reduce((n, p) => n + p.bytes, 0);
    if (pieceBytes + kitBytes.length > 3_000_000) throw invariant('Street catalogue exceeds byte budget', {
      pieces: kit.pieces.length, pieceBytes, kitBytes: kitBytes.length, totalBytes: pieceBytes + kitBytes.length, limit: 3_000_000, excessBytes: pieceBytes + kitBytes.length - 3_000_000,
      variants: kit.pieces.map(p => ({ piece: p.id, bytes: p.bytes })) });
    const features = units.features.items.map((f, i) => ({ ...f.descriptor, placement: units.featurePlacements[i]! }));
    const manifest: NativeStreetManifest = {
      meta: { version: '0.5.0', generatorVersion: pkg.version, architectureVersion: a.version, reservationVersion: a.reservationVersion,
        designVersion: request.design.version, blueprintHash: a.identity.hash, blueprintEncoding: a.identity.encoding, nativeCatalogHash: catalog.hash, seed: request.seed,
        identity: hash(JSON.stringify([a.identity, catalog.hash, request.seed, request.design, pkg.version])), units: 'meters' },
      kit, placements, files: { kit: 'streets/kit.json', placements: 'streets/placements.json' }, closures: units.plan.closures, report: { profiles: units.profiles.mappings, overhangs: units.overhangs, degraded: a.degraded },
      ground: units.ground, features, materials: { mode: 'native-reference', binding: catalog.binding }, wear: { ...units.wear.snapshot(), application: 'instance' }, protected: a.protections,
      delegated: { highways: { source: 'streets.highwayStructures', hash: a.highwayHash, count: a.protections.filter(p => p.kind === 'highway').length },
        stations: { source: 'transit.subwayStations', hash: a.stationHash, stationIds: [...new Set([...a.stationBays.map(b => b.stationId), ...a.shafts.map(s => s.stationId)])] }, remainingGroundIndices: a.remainingGroundIndices },
      statistics: { pieces: kit.pieces.length, pieceBytes, placements: units.placements.length, placementBytes: placementBytes.length,
        triangles: kit.pieces.reduce((n, p) => n + p.triangles, 0), materials: surfaces.size, groundOwners: a.owners.reduce((n, o) => n + o.ground.length, 0), features: features.length, panels: units.panels },
    };
    if (output) { await output.asset(manifest.files.kit, kitBytes); await output.asset(manifest.files.placements, placementBytes); await output.finish(manifest); }
    else { assets[manifest.files.kit] = kitBytes; assets[manifest.files.placements] = placementBytes; }
    return { ...manifest, assets };
  } catch (error) {
    await output?.abort();
    if (error instanceof StreetsError) throw error;
    throw invariant('Native street construction failed', { cause: error instanceof Error ? error.message : String(error) });
  }
}
