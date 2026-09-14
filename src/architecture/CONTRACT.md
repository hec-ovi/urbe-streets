# Native architecture adapter

`readNativeAtlas(unknown)` in [NativeAtlas.ts](NativeAtlas.ts) returns [NativeArchitecture](native-schema.ts) from blueprint 0.22.0 or 0.23.0 and reservations 1.0.0. A string is a saved UTF-8 JSON path: its bytes are read once, hashed and parsed without rewriting. Object input hashes UTF-8 JSON.stringify with property/array order retained. The identity declares its encoding. Archive indexes fail explicitly. Planning support clearances are 0.5 m for tree anchors, 0.15 m for pole/bin anchors, 1 m for signals and 6 m for parcel accesses; Engine checks final dressing bounds against constructed feature bounds. The adapter retains exact ground indices, supports, legal lanes/turns, approaches, guard reservations, station openings and protected infrastructure; it creates no surfaces or alternative layout.

Depends on [Atlas](../../../atlas/CONTRACT.md) and [geometry](../geometry/CONTRACT.md).

The returned version retains the exact input version. Blueprint 0.23.0 diagonal candidates are non-owning proposals and do not change the reservation handoff consumed here.
