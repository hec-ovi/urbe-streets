# ground

Checks the physical street solids against their retained planning cover.

`buildGround(` [Architecture](../architecture/schema.ts) `)` returns [StreetManifest.ground](../schema/result.ts). Owners keep source IDs, polygon, role and levels. Stacked solids may overlap in plan; interiors cannot overlap in volume. Markings are excluded. Missing or excess cover and solid overlap return `E_INVARIANT`; parcel encroachment returns `E_UNSATISFIABLE`.

Depends on [geometry](../geometry/CONTRACT.md).
