# Streets 0.7.0

Builds reusable street pieces and placements from saved Atlas 0.26.0 with planning reservations 2.1.0.

`build(request,options):Promise<NativeStreetBuild>` from [src/index.ts](src/index.ts), also exported as `buildNative`. Inputs: [request](src/schema/native-request.ts), [native material binding](src/schema/native-materials.ts). Output: [manifest 0.3.0](src/schema/native-result.ts).

Required values are a saved blueprint object or JSON path, integer seed, design `{version:'native-1.0.0',wear:0..1}` and `options.nativeMaterials`. Paths are caller supplied. A blueprint file hashes its exact bytes; object input hashes ordered UTF8 JSON.stringify. Catalog and delegated infrastructure hashes use ordered JSON.stringify. Piece hashes cover exact GLB bytes. Archive indexes fail explicitly.

## Piece kit

The bundle contains `manifest.json`, `streets/kit.json`, `streets/placements.json` and `streets/pieces/**/*.glb`. Kit files resolve relative to `streets/kit.json`. Draft 2020 12 schemas: [kit](schemas/street-kit.schema.json), [placements](schemas/street-placement.schema.json). Shared types: [street kit](src/schema/street-kit.ts).

Every segment contains the full cross section, including both receiving sidewalks, panel rows, curbs, sloped gutters, lanes, separators and the saved median. Straight units are 8 m long. Parking, drain openings, differing widths, opposite sidewalk palettes and median ends retain fitted variants. Existing construction supplies their dimensions and `streetNativeSurface` material names. Lane dashes repeat 4 m painted and 4 m clear.

Junction pieces use the incident street class pair, fitted crossing arms with corner returns, and one shared central box. Arms include the first 8 m beyond each crossing when the clear span permits it, containing its approach markings. The remaining run uses whole 8 m segments followed by at most one 4 m and one 2 m closure against the last arm. `closures` names each exact road, original length, remaining stations and piece counts. Unrepresentable lengths fail with road evidence. No street piece is stretched.

Props retain the source feature positions, shapes, styles and marquee messages. Drains use a surface variant with its receiving opening and a shared inlet insert. Wear scans retain their original authored footprints in separate noncolliding marking placements. Only marking placements carry `scale`, expressing those scan dimensions.

Ids belong to a deterministic family inventory within the bundle. Only profiles used by the plan are published. Each kit entry publishes its id, file, size in metres, local bounds, origin rule, surfaces, collision flag, receiving footprint, triangles, bytes and SHA256. Segment X follows its run, junction origins are at the shared node, and props use their hardware anchor at the road datum. Coordinates are X right, Y up, Z forward. Apply complete GLB node transforms, then placement scale if present, positive Y rotation in radians, and translation.

A placement names the piece, world position, rotationY, primary original ownerId and every covered ownerId. `cell` is `[floor(x/128),floor(z/128)]` at its origin. Cell boundaries do not cut geometry. Each prop also names its original featureId. Engine can instance each piece and use its transformed local bounds for collision when `hasCollision` is true.

## Ground and materials

Placement footprints prove complete coverage of every original ground owner without overlap. `ground.replacements` retains exact original ground indices and module owner ids. Ground polygons, feature bounds, material bindings, station exclusions and delegated infrastructure identities retain their source coordinates. Highways and station interactions remain delegated; only `delegated.remainingGroundIndices` can accompany native ordinary ground.

GLBs use shared indexed attribute and triangle streams, required `KHR_mesh_quantization` and `EXT_meshopt_compression`, and no texture bytes. Register MeshoptDecoder on the GLTF loader. Decoded positions stay within 1 mm of the authored Float32 reference, with identical triangle counts. Material primitives carry `streetNativeSurface` through their materials and `streetCollision` directly; mesh nodes also carry collision admission. Attributes include position, normal, UV, `_STREET_WEAR` and `_STREET_HEIGHT`. [Assets contract](src/assets/CONTRACT.md).

Engine binds the exact native material snapshot and samples world UV materials after placement. `wear.application` is `world-position`: the shared prototypes have a neutral wear attribute, and Engine evaluates the saved field at each world vertex. For each saved zone, `t=max(0,1-distance/radius)`; wear is `min(1,amount*max(0.025,strength*t*t*(3-2*t)))` across all zones. This retains one continuous city field with instanced geometry.

## Build behavior

The same plan, seed, design and native binding produce byte identical pieces, placements and manifests. Timing and output paths do not affect identity. Construction and encoding run sequentially in the calling thread.

Mode defaults to `glb`. Without outDir, `assets` contains both JSON documents and GLB bytes. With outDir, the destination must be new and its parent must exist; the manifest is written last and `assets` is empty. Manifest mode publishes the same kit metadata, hashes and placements with JSON assets only. Kit triangles and bytes count unique geometry; placement bytes count exact compact JSON bytes.

Errors use [StreetsError](src/errors.ts): `E_INVALID_PARAMS` for requests, bindings and IO; `E_UNSUPPORTED_ARCHITECTURE` for source versions or profiles; `E_UNSATISFIABLE` for excluded land; `E_INVARIANT` for coverage, source fit or export failures. No substitute geometry or material is generated.

Dependencies: [Atlas](../atlas/CONTRACT.md), [native Materials](../materials/sources/streets/scene-native/CONTRACT.md), and the boxes in [INDEX](docs/INDEX.md). No sibling runtime imports or renderer.
