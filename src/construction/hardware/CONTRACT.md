# Native street hardware

Builds source guards, closed inlets, inset channels and access cassettes. `createHardware(options)` in [index.ts](index.ts) takes [FurnitureOptions](schema.ts), returns owned geometry parts with native surface names and idempotent disposal. No renderer or materials are created. Surface names resolve through the [native Materials binding](../../../../materials/sources/streets/scene-native/CONTRACT.md).

Local X follows the curb, Z points into the sidewalk, Y is height above the road. Positions, normals and UVs retain the original source construction. Box, prism and tube UVs use metres; cylindrical collars retain their source cylinder coordinates. Six guard styles include tubular loops, cast concrete, reinforced frames, collar bollards, portable barriers and concrete with inserts. Inlets replace Z=0..0.5 m across gutter/curb and close the pit below road level. Channels occupy their supplied sidewalk footprint. Caller owns placement, reservation checks and conversion to export buffers. LED ramps/screens are outside this entry.

Lengths/depths must be positive finite metres; guard styles are 0..5, other styles 0..3; damaged is boolean. Invalid options use `E_INVALID_PARAMS`. [Provenance](provenance.json) records source file hashes. The source geometry uses Three.js 0.185.1; no sibling runtime imports.
