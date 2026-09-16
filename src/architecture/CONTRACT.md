# Native architecture adapter

Source and district module formats retain their published geometry. District frontages use 4.2 m paving, 0.2 m curbs, 0.5 m gutters and 2 m-deep parking. Median owners retain their 2 m paving, complete footprint and ornament anchors. Roads retain the Atlas district style and central median width; style selection does not depend on asset cell boundaries.

Median stations and widths match their straight road, footprint and paving match the physical owner's ground, and ornament anchors stay inside paving. Opposite avenue lane pairs leave the declared median clear. Parking slots stay inside their owned bay; walking clearance equals paved width minus parking depth. Malformed format, style, dimensions or geometry fail with `E_UNSUPPORTED_ARCHITECTURE` and a field path.

`readNativeAtlas(unknown)` in [NativeAtlas.ts](NativeAtlas.ts) returns [NativeArchitecture](native-schema.ts) from blueprint 0.22.0, 0.23.0 or 0.24.0 and reservations 1.0.0. A string is a saved UTF-8 JSON path: its bytes are read once, hashed and parsed without rewriting. Object input hashes UTF-8 JSON.stringify with property/array order retained. The identity declares its encoding. Archive indexes fail explicitly. Planning support clearances are 0.5 m for tree anchors, 0.15 m for pole/bin anchors, 1 m for signals and 6 m for parcel accesses; Engine checks final dressing bounds against constructed feature bounds. The adapter retains exact ground indices, supports, legal lanes/turns, approaches, guard reservations, station openings and protected infrastructure; it creates no surfaces or alternative layout.

Depends on [Atlas](../../../atlas/CONTRACT.md) and [geometry](../geometry/CONTRACT.md).

The returned version retains the exact input version. Blueprint 0.23.0 diagonal candidates are non-owning proposals and do not change the reservation handoff consumed here.
