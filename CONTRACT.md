# Streets 0.6.0

Builds bounded source-native street GLBs from saved Atlas reservations, with exact ground ownership and native material references.

`build(request,options):Promise<NativeStreetBuild>` from [src/index.ts](src/index.ts) (`buildNative` is the same entry). Inputs: [request](src/schema/native-request.ts), [native material binding](src/schema/native-materials.ts). Output: [native result](src/schema/native-result.ts). Required: blueprint, integer seed, design `{version:'native-1.0.0',wear:0..1}`, and options.nativeMaterials (binding object or JSON path). Blueprint 0.26.0 and planning reservations 2.1.0 are required; `reservationVersion` reports `streets.construction.planningReservations.version`, and surfaces follow exact ground polygons independently of cap vertex counts. No source layout is generated downstream.

A blueprint string is a saved JSON path: read bytes once, hash SHA-256, parse the same UTF-8 content. Object input hashes UTF-8 JSON.stringify retaining property/array order, without indentation/newline. `blueprintEncoding` declares the rule. Native catalog and delegated infrastructure hashes use the same ordered JSON.stringify rule on their exact parsed values; assets hash exact GLB bytes. Archive indexes fail explicitly.

Source panel rows, corner fans, parking panels, sloped gutters, curbs, inlets, guards, access plates and road markings fit the published owner frames. Whole panels keep their original UV domain; wear is one continuous saved world field sampled before splitting. Original source geometry, source revision and independent conformance fixtures are recorded in the construction boxes. Missing coverage, unsupported profiles or source identities fail with owner evidence. Optional source hardware candidates require their whole receiving footprint.

Pieces occupy 128 m XZ cells. Root node translation restores each piece origin; full mesh node transforms decode local positions. Nodes and primitives carry `streetCollision:boolean`; materials carry `streetNativeSurface`. Attributes are position, normal, UV, `_STREET_WEAR` and `_STREET_HEIGHT`. Paint/decal primitives are noncolliding.

Indexed GLBs require `KHR_mesh_quantization` and `EXT_meshopt_compression`. Consumers must register the meshopt decoder (Three GLTFLoader: `setMeshoptDecoder(MeshoptDecoder)`) and apply complete node transforms. Decoded positions stay within 1 mm in 3D of the Float32 reference, with identical triangle counts. Attribute types, precision and Float32 retention rules are in the [assets contract](src/assets/CONTRACT.md).

No texture bytes are embedded. The native binding snapshot supplies safe package-relative texture paths and source scan hashes; Engine owns texture loading and effect implementation.

`ground.replacements` names exact original ground indices and module owner IDs to suppress. Per-owner receiving cover excludes station shafts and cannot enter parcels/water. Features publish stable world bounds and source identities independently of cell residency. Elevated highways remain delegated to the highway renderer, and station stairs/interactions remain delegated to the station renderer. Their exact source hashes and non-owning protection references are retained; only delegated.remainingGroundIndices may be rendered alongside native ordinary ground.

Each reserved owner is built independently, by default on `max(1, floor(availableParallelism() / 4))` worker threads and never more workers than owners. `STREETS_WORKERS` overrides that count exactly; 0 or 1 builds every owner in the calling thread. The pool changes only where the work runs: coverage, the 128 m partition and the export stay in the calling thread, owners are consumed in their published order, and the bundle is identical either way.

Mode defaults to `glb`. Without outDir, bytes are returned in assets. A disk destination must be new, with an existing parent; `<outDir>/manifest.json` is published after relative pieces and excludes assets. Manifest mode retains piece geometry metadata with null asset/hash and no bytes. The same input values produce identical geometry and manifests; paths and timing are excluded from identity.

Errors: [StreetsError](src/errors.ts), `E_INVALID_PARAMS` (request/material/IO), `E_UNSUPPORTED_ARCHITECTURE` (version/reference/profile), `E_UNSATISFIABLE` (excluded land), `E_INVARIANT` (coverage, source fit, triangulation or export). No fallback geometry or material is generated.

Dependencies: [Atlas](../atlas/CONTRACT.md), [reservations](../atlas/src/streets/layout/reservations/CONTRACT.md), [native Materials](../materials/sources/streets/scene-native/CONTRACT.md), and the boxes in [INDEX](docs/INDEX.md). Runtime packages are glTF Transform core/extensions, meshoptimizer, clipper2-ts, earcut and source-compatible Three 0.185.1 geometry; no sibling runtime imports or renderer.

District-format blueprints use uniform whole-block panel palettes, concentric corner bands, 2 m parking, subtle luxury hexagons, central junction transitions, crossing ramps and modeled inlet/cable/marquee/tree-grate details. Atlas owns their reservations and medians; the [district construction contract](src/construction/district/CONTRACT.md) owns fitted geometry. Solid emission and display materials follow the authored Materials binding.
