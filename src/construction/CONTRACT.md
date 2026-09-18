# Street construction

`StreetUnits(architecture,seed,wear)` takes [Atlas architecture](../architecture/native-schema.ts) and returns a fixed kit, [placements, profile mappings and closures](../schema/street-kit.ts), exact ground coverage, original feature descriptors and the wear field. [Units contract](units/CONTRACT.md).

Runs use 8 m cross sections, 4 m and 2 m closures. Fractional remainders scale a plain 2 m closure along its run. Junctions select stored profile configurations and clip at their receiving boundary. Markings, scans, wear, palette regions and marquee text are placement attributes. Construction uses one calling thread.

Dependencies: [architecture](../architecture/CONTRACT.md), [district](district/CONTRACT.md), [markings](markings/CONTRACT.md), [surfaces](surfaces/CONTRACT.md), [features](features/CONTRACT.md), [style](style/CONTRACT.md), [hardware](hardware/CONTRACT.md).
