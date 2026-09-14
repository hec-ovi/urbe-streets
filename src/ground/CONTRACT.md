# Native ground ownership

`NativeCoverage(architecture).add(owner,claims)/finish()` verifies each native owner's complete receiving cover independently, excludes only declared station shafts, and rejects parcel/water encroachment. It publishes exact original ground indices and module owner IDs for replacement, with original reservation levels and measured cover areas. Unknown, repeated or missing owners fail. Surface builders independently prove visible layout intent and hardware closure before submitting physical claims; paint never contributes coverage. [Native ground result](../schema/native-result.ts).

Input: [NativeArchitecture](../architecture/native-schema.ts) and [CoverageClaim](../construction/surfaces/schema.ts). Output: [NativeStreetManifest.ground](../schema/native-result.ts). Depends on [geometry](../geometry/CONTRACT.md).
