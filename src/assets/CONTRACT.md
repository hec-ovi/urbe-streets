# assets

Splits construction at 128 m cell boundaries and emits one GLB per occupied cell.

`partitionPieces(` [surfaces](../architecture/schema.ts) `)` retains source IDs and UV frames. `encodePiece` returns bytes, measured city-frame bounds and triangle count. The [manifest](../schema/result.ts) names every asset and its ground owners. Mesh primitives batch by material key and variant.

`Output` writes only into a new destination and publishes the manifest last. IO errors use `E_INVALID_PARAMS`; geometry/export failures propagate as `E_INVARIANT` through `build`.

Depends on [geometry](../geometry/CONTRACT.md), [finishes](../finishes/CONTRACT.md), glTF Transform core and Node IO.

`NativePartition.add(NativeMesh)/finish()` clips actual source triangles at 128 m XZ boundaries, preserving whole-face UVs, wear and height through linear interpolation. Original vertex normals remain exact; new cut normals normalize the interpolated direction. Each triangle must retain its full 3D area. [Native schema](native-schema.ts).

`encodeNativePiece` returns bounded GLB bytes with local Float32 positions and node translations restoring the world origin. Nodes and primitives carry `streetCollision`; materials carry `streetNativeSurface`. Native attributes are `_STREET_WEAR` and `_STREET_HEIGHT`, alongside standard position, normal and UV. Separate collision groups share named bindings without embedded textures. Piece bounds retain the source world coordinates.
