# Native assets

`encodeNativePiece` takes [NativePieceData](native-schema.ts) and returns encoded bytes, source bounds and triangle count. Malformed attributes or duplicate source ids raise E_INVARIANT. Piece coordinates are local. The root supplies its origin; the shared attribute node supplies the quantized position transform. Apply placement transforms afterward.

Equal complete Float32 vertices share indices. All materials reference one attribute stream and one compressed triangle stream, with separate index accessor slices. Mesh nodes group compatible collision and ownership values. Materials carry `streetNativeSurface`; primitives and mesh nodes carry `streetCollision`. Each primitive retains its source identity in `streetSource`. [Native schema](native-schema.ts).

GLBs require `KHR_mesh_quantization` and `EXT_meshopt_compression`, with no uncompressed fallback bytes. Register MeshoptDecoder on the loader. No textures are embedded.

| Attribute | Storage and precision |
| --- | --- |
| POSITION | Normalized int16 and a uniform node transform when every vertex decodes within 1 mm of its local Float32 reference; otherwise Float32. |
| NORMAL | Normalized int16 with component error at most 1/32767; out of range streams retain Float32. |
| TEXCOORD_0 | Normalized uint16 for streams within 0..1, with error at most 1/65535; tiled or negative streams retain Float32. |
| _STREET_WEAR, _STREET_HEIGHT | Smallest normalized integer stream satisfying every primitive's range divided by 255; constant primitive fields require exact Float32 readback. Otherwise Float32. |

`npm run test:compression -- --blueprint sample.json` compares every decoded kit triangle with the Float32 writer and reports bytes, triangles, position error and attribute types.

`Output` owns a newly created destination, writes relative assets and publishes manifest.json last. IO failures use E_INVALID_PARAMS; abort removes only its own new directory. Dependencies: [surfaces](../construction/surfaces/CONTRACT.md), [result](../schema/native-result.ts), glTF Transform core and extensions, meshoptimizer and Node IO. Shared index slices follow the [glTF buffer rules](https://github.com/KhronosGroup/glTF/blob/main/specification/2.0/Specification.adoc) and [meshopt extension](https://github.com/KhronosGroup/glTF/blob/main/extensions/2.0/Vendor/EXT_meshopt_compression/README.md).
