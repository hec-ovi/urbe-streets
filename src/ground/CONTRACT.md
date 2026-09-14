# ground

Checks the physical street solids against their retained planning cover.

`buildGround(` [Architecture](../architecture/schema.ts) `)` returns [StreetManifest.ground](../schema/result.ts). Owners keep source IDs, polygon, role and levels. Stacked solids may overlap in plan; interiors cannot overlap in volume. Markings are excluded. Missing or excess cover and solid overlap return `E_INVARIANT`; parcel encroachment returns `E_UNSATISFIABLE`.

Depends on [geometry](../geometry/CONTRACT.md).

`NativeCoverage(architecture).add(owner,claims)/finish()` verifies each native owner's complete receiving cover independently, excludes only declared station shafts, and rejects parcel/water encroachment. It publishes exact original ground indices and module owner IDs for replacement, with original reservation levels and measured cover areas. Unknown, repeated or missing owners fail. Surface builders independently prove visible layout intent and hardware closure before submitting physical claims; paint never contributes coverage. [Native ground result](../schema/native-result.ts).
