# Street units

`StreetUnits(architecture,seed,wear)` takes [Atlas architecture](../../architecture/native-schema.ts) and returns the fixed catalogue, [placements, width mappings, overhangs and closures](../../schema/street-kit.ts), receiving ground coverage and original feature descriptors.

[profiles.json](profiles.json) defines every class and zone. `KitCatalogue` builds 187 pieces without plan data: 75 segments, 30 junction arms and short returns, 45 centres, 27 props and 10 overlays. Paint, corner seams, palettes and display faces are baked. Overlay pieces hold seven arrow combinations, two drain faces and one scan quad. Inventory and compact kit JSON stay within 200 pieces and 3 MB.

`ProfileCatalogue` reports nearest width mappings. `UnitPlan` partitions runs and junctions. `ParkingUnits` gives each authored bay one 8 m parking unit per slot: the units its footprint covers most, preferring units without a drain, reaching along its own run when the footprint covers fewer whole units than the bay holds slots. `StationPlacements` fits whole pedestrian pieces around shafts. Fractional remainders scale plain closures. `StreetUnits` emits transforms and shader values under the [placement contract](../../../CONTRACT.md), with feature placement indices retained separately in the manifest.

`placementFootprint(piece,placement)` applies only scale, rotation and position. `UnitCoverage` checks those complete footprints against shafts and receiving ground, reports boundary and fringe overhangs and measures physical surface overlap. Owner intersections are coverage measurements. They do not alter a rendered or collidable piece.

Dependencies: [architecture](../../architecture/CONTRACT.md), [district](../district/CONTRACT.md), [surfaces](../surfaces/CONTRACT.md), [markings](../markings/CONTRACT.md), [features](../features/CONTRACT.md), [style](../style/CONTRACT.md), [hardware](../hardware/CONTRACT.md), [ground](../../ground/CONTRACT.md), [assets](../../assets/CONTRACT.md).
