# Native assets

`NativePartition.add(NativeMeshData)/finish()` accepts plain or Float64Array vertex fields and clips actual source triangles at 128 m XZ boundaries, preserving whole-face UVs, wear and height through linear interpolation. Original vertex normals remain exact; new cut normals normalize the interpolated direction. Each triangle must retain its full 3D area. [Native schema](native-schema.ts).

`encodeNativePiece` returns bounded GLB bytes with local Float32 positions and node translations restoring the world origin. Nodes and primitives carry `streetCollision`; materials carry `streetNativeSurface`. Native attributes are `_STREET_WEAR` and `_STREET_HEIGHT`, alongside standard position, normal and UV. Separate collision groups share named bindings without embedded textures. Piece bounds retain the source world coordinates.

`Output` owns a newly created destination, writes relative pieces and publishes manifest.json last. IO failures use E_INVALID_PARAMS; abort removes only its newly created directory. Dependencies: [surfaces](../construction/surfaces/CONTRACT.md), [native result](../schema/native-result.ts), glTF Transform and Node IO.
