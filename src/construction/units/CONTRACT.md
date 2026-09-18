# Street units

Takes [Atlas architecture](../../architecture/native-schema.ts), seed and wear; returns reusable local [pieces, placements and closures](../../schema/street-kit.ts), exact ground coverage, original feature descriptors and the saved wear field. Streets uses the existing district surfaces, edge profiles, markings and hardware.

Straight runs repeat 8 m units, with at most one 4 m and one 2 m closure at the last junction. Junction arms include an 8 m approach marking span where it fits. Arms and central boxes use the incident class pair. Exact receiving polygons determine fitted boundary, parking and median variants. Props retain their saved feature anchors. Marking instances use their original scan dimensions; street segments use unit scale. Placement coverage restores original ground owner identity.

Dependencies: [architecture](../../architecture/CONTRACT.md), [district](../district/CONTRACT.md), [surfaces](../surfaces/CONTRACT.md), [markings](../markings/CONTRACT.md), [features](../features/CONTRACT.md), [style](../style/CONTRACT.md), [hardware](../hardware/CONTRACT.md), [ground](../../ground/CONTRACT.md), [assets](../../assets/CONTRACT.md).
