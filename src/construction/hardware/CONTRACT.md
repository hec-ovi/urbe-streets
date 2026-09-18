# Native street hardware

Builds source guards, closed inlets, inset channels and access cassettes. `createHardware(options)` in [index.ts](index.ts) takes [FurnitureOptions](schema.ts), returns owned geometry parts with native surface names and idempotent disposal. No renderer or materials are created. Surface names resolve through the [native Materials binding](../../../../materials/sources/streets/scene-native/CONTRACT.md).

Local X follows the curb, Z points into the sidewalk, Y is height above the road. Positions, normals and UVs retain the original source construction. Box, prism and tube UVs use metres; cylindrical collars retain their source cylinder coordinates. Six guard styles include tubular loops, cast concrete, reinforced frames, collar bollards, portable barriers and concrete with inserts. Inlets replace the gutter band plus the 0.2 m curb mouth and close the pit below road level. Channels occupy their supplied sidewalk footprint. Caller owns placement, reservation checks and conversion to export buffers. Marquee ramps provide framed wedge geometry; the unit catalogue supplies the illuminated face. Cable pieces provide five exposed tubes, sockets and a shallow tray. Cable, marquee and tree-grate pieces require length at least 1 m and depth at least 0.4 m.

Lengths/depths must be positive finite metres; guard styles are 0..5, other styles 0..3; damaged is boolean. Invalid options use `E_INVALID_PARAMS`. [Provenance](provenance.json) records source file hashes. The source geometry uses Three.js 0.185.1; no sibling runtime imports.

Inlet depth is the full gutter plus the 0.2 m curb band. Source inlets use 0.5 m; district inlets use 0.7 m. The gutter grate expands to the declared depth while the curb mouth remains 0.2 m deep.

Tree grates provide a framed square with a circular trunk opening at paved height. The caller places the tree from the same Atlas median anchor.
