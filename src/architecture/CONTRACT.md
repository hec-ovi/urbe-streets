# architecture

Reads Atlas 0.21.0 at-grade construction in one adapter.

`readAtlas(unknown)` returns [Architecture](schema.ts). It expands modules 1.0.0, retains non-module ground and crossing stripes, and checks source versions, basic geometry, lane bounds and IDs. It imports no sibling code. Unsupported fields/features return `E_UNSUPPORTED_ARCHITECTURE`; reservation mismatches return `E_UNSATISFIABLE`.

`readNativeAtlas(unknown)` in [NativeAtlas.ts](NativeAtlas.ts) returns [NativeArchitecture](native-schema.ts) from blueprint 0.22.0 and reservations 1.0.0. A string is a saved UTF-8 JSON path: its bytes are read once, hashed and parsed without rewriting. Object input hashes UTF-8 JSON.stringify with property/array order retained. The identity declares its encoding. Archive indexes fail explicitly. Planning support clearances are 0.5 m for tree anchors, 0.15 m for pole/bin anchors, 1 m for signals and 6 m for parcel accesses; Engine checks final dressing bounds against constructed feature bounds. The adapter retains exact ground indices, supports, legal lanes/turns, approaches, guard reservations, station openings and protected infrastructure; it creates no surfaces or alternative layout.

Depends on [Atlas](../../../atlas/CONTRACT.md) and [geometry](../geometry/CONTRACT.md).
