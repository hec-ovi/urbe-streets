# Streets 0.9.1

Builds a shared street catalogue and city placements from saved Atlas 0.26.0 with planning reservations 2.1.0.

`build(request,options):Promise<NativeStreetBuild>` from [src/index.ts](src/index.ts), also exported as `buildNative`. Inputs: [request](src/schema/native-request.ts), [material binding](src/schema/native-materials.ts). Output: [manifest 0.5.0](src/schema/native-result.ts).

Required: saved blueprint object or JSON path, integer seed, design `{version:'native-1.0.0',wear:0..1}` and `options.nativeMaterials`. Paths come from the caller. Blueprint files hash their exact bytes; object inputs, material bindings and delegated infrastructure hash ordered UTF8 JSON.stringify. Piece hashes cover exact GLB bytes. Archive indexes fail explicitly.

## Shared catalogue

Every build publishes identical `streets/kit.json` and `streets/pieces/**/*.glb`, including unused profiles. The [catalogue](src/construction/units/profiles.json) defines 4 m single lane streets, 7 m two lane streets, 14 m avenues, 17.4 m avenues with 3.4 m medians, and pedestrian alleys across ordinary, luxury and industrial zones. Motor streets have 4.2 m paving, 0.2 m curbs and 0.5 m gutters. Alley half widths are 1.8, 2.5 and 2 m respectively.

The complete inventory has 187 pieces: 75 segments, 30 junction arms and short returns, 45 centres, 27 props and 10 overlays. Each profile has plain, parking and drain 8 m segments plus plain 4 m and 2 m closures. Each arm starts at the crossing carriageway edge; the cross street width changes its placement position. Centres cover unordered profile pairs; rotation handles reversed pairs. Zone materials, approach paint and diagonal corner seams are baked. Road dashes have one phase: local X from 0 to 4 m painted, then 4 m clear. Closures have no paint.

Overlays comprise seven combinations of through, left and right arrows, drain faces for 0.5 m and 0.7 m gutter and curb bands, and one scan quad. Drain overlays include the visible grate, dark curb mouth and 2 m tread insert. They sit on the receiving surfaces and have no collision. Props retain the original hardware geometry. All catalogue construction is independent of city, seed, wear and material binding.

The budget is at most 200 pieces and 3,000,000 bytes for all GLBs plus compact kit JSON. Exceeding either budget fails with measured totals before publishing a bundle. `report.profiles` lists widths mapped to the nearest profile within their class and zone, with roadId, profileId, requestedWidth, width and signed delta in metres. Catalogue order breaks ties. Uncovered mapped width remains measured in `ground.cover.missingArea`.

## Placements

Kit [1.2.0](schemas/street-kit.schema.json), placements [1.2.0](schemas/street-placement.schema.json). Shared [types](src/schema/street-kit.ts). Piece files resolve relative to `streets/kit.json`. Coordinates are X right, Y up, Z forward. Each piece supplies bounds, footprint, surfaces, collision flag, triangle count, bytes and SHA256.

Each placement carries only `piece`, `position`, `rotationY`, optional `scale`, `cell`, `ownerId`, `ownerIds` and optional shader values `tint`, `wear`, `scan`, `text`. Draw every primitive in the referenced GLB. Apply complete GLB node transforms, positive local XYZ scale (default `[1,1,1]`), positive Y rotation in radians, then world position. Rendering and collision use the complete transformed geometry. `placementFootprint(piece,placement)` applies that same placement transform to the piece footprint.

| Shader value | Meaning and default |
| --- | --- |
| `tint` | Linear RGB multiplier in 0 to 1, default `[1,1,1]`. |
| `wear` | Sampled wear amount in 0 to 1, default 0. |
| `scan` | `{offset:[u,v],scale:[u,v]}` applied as `uv * scale + offset`, default identity. |
| `text` | Glyph indices into `kit.glyphs`, default empty. |

The scan piece is one unit quad with local UV `[x+0.5,0.5-z]`. Placement scale supplies its dimensions. `kit.scanAtlas` orders four equal horizontal UV cells: damage, fracture, repair and oil. Resolve each cell to its native surface maps once when preparing the shared scan material; UV cell selection happens in the shader. Marquee pieces contain a display face with UV 0 to 1. Its physical width is 1.8 m and sloping height is `hypot(0.44,0.44*0.16/0.46)` m. For N glyphs, the shader centres an area of width `N*w` and height `w`, where `w=min(0.24,1.8/N)`. Glyph i samples column `i%8` and row `floor(i/8)` of the existing 8 by 6 font atlas, with bottom V `1-(floor(i/8)+1)/6`. Space and the area outside the glyphs are transparent. No placement value changes geometry.

Straight runs use 8 m segments, at most one 4 m and one 2 m closure, then a plain 2 m closure scaled along X for a fractional remainder. `closures` records roadId, length, remaining stations, piece counts and fittedLength. Station aprons tile pedestrian pieces around shafts; edge tiles scale to their rectangular receiving area. Retained ground below highways uses ordinary surface profiles; elevated structures stay delegated.

`cell` is `[floor(x/128),floor(z/128)]`. Cells do not split pieces. Every placement identifies its primary owner and all ground owners touched by its footprint. Feature records retain source identities, anchors and the index of their prop placement in `features[].placement`. Shaft and station references, original ground indices and delegated infrastructure remain in the manifest.

Coverage and collision checks start from whole transformed piece footprints. Physical pieces cannot enter station shafts. Intersections with owner reservations measure coverage only. Boundary and fringe overhangs remain drawn and collidable. `report.overhangs.accepted` lists placement index, piece, boundaryArea outside the city and fringeArea inside the city beyond its receiving region. `report.degraded` lists every parking bay the box cannot build, with its authored id and the reason; the bay leaves the placements and the ordinary segment keeps its ground covered. Totals sum those per placement areas; overlapArea measures repeated physical surface coverage. `ground.cover.outsideArea` measures the union outside retained reservations. Paint and other overlays contribute no ground coverage.

## Materials and output

GLBs contain no textures. They use shared indexed streams and require `KHR_mesh_quantization` and `EXT_meshopt_compression`. Register MeshoptDecoder. Decoded positions stay within 1 mm of authored Float32 positions. Materials carry `streetNativeSurface`; primitives carry `streetCollision` and `streetSource`. Attributes include position, normal, UV, `_STREET_WEAR` and `_STREET_HEIGHT`. [Assets contract](src/assets/CONTRACT.md).

Shared vertex wear is neutral. Streets samples the wear field at each placement anchor and publishes the result in `wear`. The manifest retains the field with `application: instance` for inspection and carries the complete native material snapshot.

Construction and encoding run sequentially in the calling thread. Equal requests produce byte identical manifests and placements. Without outDir, assets contains JSON and GLB bytes. With outDir, the destination must be new and its parent must exist; manifest.json is written last and assets is empty. Manifest mode emits the same metadata with JSON assets only. Statistics count unique GLB bytes and exact compact placement JSON bytes.

Errors: `E_INVALID_PARAMS` for requests, bindings and IO; `E_UNSUPPORTED_ARCHITECTURE` for a plan the box cannot read, meaning its versions, sections or malformed profiles; `E_UNSATISFIABLE` for excluded receiving land; `E_INVARIANT` for coverage, budgets or export failures. [StreetsError](src/errors.ts).

Dependencies: [Atlas](../atlas/CONTRACT.md), [native Materials](../materials/sources/streets/scene-native/CONTRACT.md), and the boxes in [INDEX](docs/INDEX.md). No renderer or sibling runtime imports.
