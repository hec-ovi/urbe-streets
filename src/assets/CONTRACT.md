# Native assets

`NativePartition.add(NativeMeshData)/finish()` accepts plain or Float64Array vertex fields and clips actual source triangles at 128 m XZ boundaries, preserving whole-face UVs, wear and height through linear interpolation. Original vertex normals remain exact; new cut normals normalize the interpolated direction. Each triangle must retain its full 3D area. [Native schema](native-schema.ts).

`encodeNativePiece` takes [NativePieceData](native-schema.ts) and returns [NativeEncodedPiece](native-schema.ts), with source bounds and the exact triangle count. Vertices share indices within a primitive only when all five Float32 fields match. Uint16 indices serve up to 65,535 unique vertices; larger primitives use uint32. Meshopt can cyclically rotate triangle vertices without changing winding or triangle order.

Pieces require `KHR_mesh_quantization` and `EXT_meshopt_compression`, with no uncompressed fallback bytes. Consumers register the meshopt decoder (Three GLTFLoader: `setMeshoptDecoder(MeshoptDecoder)`) and apply full node transforms. Root translation is the piece origin; a child mesh node supplies uniform position scale and offset when quantized. Nodes and primitives carry `streetCollision`; materials carry `streetNativeSurface`. Ownership lists and texture references retain their source values; textures are not embedded.

| Attribute | Storage and precision |
| --- | --- |
| POSITION | Normalized int16 with uniform node transform, only when every decoded vertex is within 1 mm in 3D of the local Float32 reference; otherwise Float32. |
| NORMAL | Normalized int16, component error at most 1/32767; values outside the normalized range retain Float32. |
| TEXCOORD_0 | Normalized uint16 for 0..1, component error at most 1/65535; tiled or negative UVs retain Float32. |
| _STREET_WEAR, _STREET_HEIGHT | Smallest normalized uint8, int8, uint16 or int16 meeting 1/255 of the primitive field range; Float32 when out of range or insufficiently precise. Constant fields require exact Float32 readback. |

`npm run test:compression -- --blueprint sample.json` constructs a saved sample sequentially, compares unquantized and compressed pieces through the meshoptimizer decoder, and reports counts, bytes, maximum position error and Float32 semantics. It requires identical triangles, error at most 1 mm and size at most one quarter.

`Output` owns a newly created destination, writes relative pieces and publishes manifest.json last. IO failures use E_INVALID_PARAMS; abort removes only its newly created directory. Dependencies: [surfaces](../construction/surfaces/CONTRACT.md), [native result](../schema/native-result.ts), glTF Transform core/extensions, meshoptimizer and Node IO.
