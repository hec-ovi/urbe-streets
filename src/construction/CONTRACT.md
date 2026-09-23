# Street construction

`StreetUnits(architecture,seed,wear)` takes [Atlas architecture](../architecture/native-schema.ts) and returns a fixed kit, [placements, profile mappings, overhangs and closures](../schema/street-kit.ts), receiving coverage, feature descriptors and a sampled wear field. [Units contract](units/CONTRACT.md).

Runs use 8 m cross sections and plain 4 m and 2 m closures. Fractional remainders scale a plain closure. Junction paint, corner seams and zone palettes are baked. Arrows, drain overlays and scans use shared overlay pieces. Placements contain transforms and shader values. Coverage and collision use whole transformed footprints; accepted overhangs remain in the report. Construction uses one calling thread.

Dependencies: [architecture](../architecture/CONTRACT.md), [district](district/CONTRACT.md), [markings](markings/CONTRACT.md), [surfaces](surfaces/CONTRACT.md), [features](features/CONTRACT.md), [style](style/CONTRACT.md), [hardware](hardware/CONTRACT.md).
