# Street units

`StreetUnits(architecture,seed,wear)` takes [Atlas architecture](../../architecture/native-schema.ts) and returns the fixed catalogue, [placements, profile mappings and closures](../../schema/street-kit.ts), ground coverage and original feature descriptors.

[profiles.json](profiles.json) lists every supported Atlas class and zone profile. `KitCatalogue` builds its complete inventory with a neutral seed and wear. Segment families contain plain, parking and drain 8 m pieces plus plain 4 m and 2 m closures. Each class pair and zone has one junction arm and centre with stored profile configurations. Props contain no text or wear variants. Kit construction accepts no plan data.

`ProfileCatalogue` selects the nearest roadway width within its class and zone and reports mismatches; data order breaks ties. `UnitPlan` partitions runs and junctions; station aprons tile pedestrian pieces. Retained ordinary ground below highways uses catalogue road profiles. Fractional remainders scale only the plain 2 m closure along X and retain `closures.fittedLength`.

`placementFootprint(piece,placement)` applies configuration, offset, scale, receiving clip and world pose. Its footprint proves coverage. The [root contract](../../../CONTRACT.md) defines the same rendering order, openings, palette regions and per instance markings, scans, wear and text. No city geometry enters a GLB.

Dependencies: [architecture](../../architecture/CONTRACT.md), [district](../district/CONTRACT.md), [surfaces](../surfaces/CONTRACT.md), [markings](../markings/CONTRACT.md), [features](../features/CONTRACT.md), [style](../style/CONTRACT.md), [hardware](../hardware/CONTRACT.md), [ground](../../ground/CONTRACT.md), [assets](../../assets/CONTRACT.md).
