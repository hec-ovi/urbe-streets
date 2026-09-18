# Street construction

`StreetUnits(architecture,seed,wear)` takes [Atlas architecture](../architecture/native-schema.ts) and returns local geometry, [placements and closure cases](../schema/street-kit.ts), exact ground coverage, original feature descriptors and the saved wear field. [Units contract](units/CONTRACT.md).

Runs use repeated 8 m full cross sections, fitted parking and drain variants, and 4 m or 2 m closures. Junction arms contain crossings and corner returns beside a shared central box. Props and wear scans use independent instances. Construction runs in the calling thread.

Dependencies: [architecture](../architecture/CONTRACT.md), [district](district/CONTRACT.md), [markings](markings/CONTRACT.md), [surfaces](surfaces/CONTRACT.md), [features](features/CONTRACT.md), [style](style/CONTRACT.md).
