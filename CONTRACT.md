# Streets 0.8.0

Builds a shared street catalogue and city placements from saved Atlas 0.26.0 with planning reservations 2.1.0.

`build(request,options):Promise<NativeStreetBuild>` from [src/index.ts](src/index.ts), also exported as `buildNative`. Inputs: [request](src/schema/native-request.ts), [material binding](src/schema/native-materials.ts). Output: [manifest 0.4.0](src/schema/native-result.ts).

Required: saved blueprint object or JSON path, integer seed, design `{version:'native-1.0.0',wear:0..1}` and `options.nativeMaterials`. Paths come from the caller. Blueprint files hash their exact bytes; object inputs, material bindings and delegated infrastructure hash ordered UTF8 JSON.stringify. Piece hashes cover exact GLB bytes. Archive indexes fail explicitly.

## Shared catalogue

Every build publishes the same `streets/kit.json` and `streets/pieces/**/*.glb`, including unused profiles. The [data catalogue](src/construction/units/profiles.json) mirrors Atlas Design.ts, DistrictDesign.ts, widths.ts and its contract: 4 m single lane streets, 7 m two lane streets, 14 m avenues, 17.4 m avenues with 3.4 m medians, and pedestrian alleys across ordinary, luxury and industrial treatments. Motor streets have 4.2 m paving, 0.2 m curbs and 0.5 m gutters. Alley half widths are 1.8, 2.5 and 2 m respectively. No sibling runtime import.

Each profile has an 8 m segment, parking segment, drain segment, 4 m closure and 2 m closure. Each unordered class pair and zone has one junction arm and centre. Profile combinations within a junction share its GLB, selected by a placement configuration. Props form a fixed hardware inventory; wear and marquee text are placement attributes. At most 200 pieces and 3,000,000 bytes for all GLBs plus compact kit JSON. Exceeding either budget fails with measured totals before a bundle is published.

`report.profiles` lists each roadway width mapped to the nearest profile within its class and zone: roadId, profileId, requestedWidth, width and signed delta in metres. Catalogue order breaks equal distance ties. Matching widths produce no report entry. A narrower mapped profile retains its fixed width; `ground.cover.missingArea` reports the uncovered reservation area. Plan, seed, wear and material binding cannot change kit identity.

## Placements

Kit [1.1.0](schemas/street-kit.schema.json), placements [1.1.0](schemas/street-placement.schema.json). Shared [types](src/schema/street-kit.ts). Files resolve relative to `streets/kit.json`. Coordinates are X right, Y up, Z forward. Each entry includes geometry identity, bounds, surfaces, collision flag, footprint, triangle count, bytes and SHA256.

Rendering and collision require the placement attributes below. A transform alone does not apply the receiving boundary.

1. Select primitives whose `streetSource` begins with `configuration + '/'` when configuration exists. Other pieces draw all primitives.
2. Apply complete GLB node transforms, local `offset`, optional `scale`, positive Y `rotationY` in radians, then world `position`. Only a fractional plain 2 m closure uses scale, `[remainder/2,1,1]`.
3. Clip surfaces and collision to `clip`, expressed in placement coordinates after offset and scale. Signed polygon contours retain holes. `openings` remove the receiving drain surface; the separately placed inlet closes it below road level. Junction corner seams and city boundaries use this same clipping rule. `placementFootprint(piece,placement)` exports the resulting world footprint for collision and coverage checks.
4. `finishes` select the original owner palette inside each local clip. `panels` select tread material at their supplied height and clip. Palette names and material roles follow the [district contract](src/construction/district/CONTRACT.md).
5. `markings` supplies seed, local road frames with dashOrigin, receiving domain, roadTop, approaches and turns to the [marking rules](src/construction/markings/CONTRACT.md). Dashes repeat 4 m painted and 4 m clear. `scans` supplies world pose, size and normalized clip for each noncolliding scan quad, with UV `[x+0.5,0.5-z]`. Text uses the [marquee glyph rules](src/construction/district/Glyphs.ts). None creates another kit piece.

Straight runs use 8 m segments, at most one 4 m and one 2 m closure, then a scaled plain 2 m closure for any fractional remainder. `closures` records roadId, full length, remaining stations, piece counts and `fittedLength`, zero for whole pieces. Fractional closures carry no markings or props. Junction arms include an 8 m approach where space permits. Station aprons tile pedestrian pieces. Retained ground below highways uses ordinary surface profiles; elevated structures and their paint stay delegated.

Every placement names primary ownerId and all covered ownerIds. Props retain featureId and the source hardware anchor. `cell` is `[floor(x/128),floor(z/128)]`; cells do not split geometry. Full source ground indices, owner identities, shafts, station references and delegated infrastructure remain in the manifest. Clipped placement footprints prove receiving ground coverage without overlap; reported width mappings retain measured coverage differences.

## Materials and output

GLBs contain no textures. They use shared indexed streams, required `KHR_mesh_quantization` and `EXT_meshopt_compression`. Register MeshoptDecoder. Decoded positions stay within 1 mm of authored Float32 positions. Materials carry `streetNativeSurface`; primitives carry `streetCollision` and `streetSource`. Attributes include position, normal, UV, `_STREET_WEAR` and `_STREET_HEIGHT`. [Assets contract](src/assets/CONTRACT.md).

Shared vertex wear is neutral. Engine evaluates `wear.application: world-position`: for each zone, `t=max(0,1-distance/radius)`, then use the maximum `strength*t*t*(3-2*t)`, with floor 0.025, multiplied by amount and capped at 1. The manifest retains the complete field and native material snapshot.

Construction and encoding run sequentially in the calling thread. Equal complete requests produce byte identical manifests and placements. Without outDir, assets contains JSON and GLB bytes. With outDir, the destination must be new and its parent must exist; manifest.json is written last and assets is empty. Manifest mode emits the same metadata with JSON assets only. Statistics count unique GLB bytes and exact compact placement JSON bytes.

Errors: `E_INVALID_PARAMS` for requests, bindings and IO; `E_UNSUPPORTED_ARCHITECTURE` for source versions or malformed profiles; `E_UNSATISFIABLE` for excluded land; `E_INVARIANT` for coverage, budgets or export failures. [StreetsError](src/errors.ts).

Dependencies: [Atlas](../atlas/CONTRACT.md), [native Materials](../materials/sources/streets/scene-native/CONTRACT.md), and the boxes in [INDEX](docs/INDEX.md). No renderer or sibling runtime imports.
