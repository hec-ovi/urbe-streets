# CONTRACT: plan

Purpose: decides every number a surface needs, before any geometry exists: the cross section inside each reserved side width, the treatment at each junction corner, and the features reserved along each frontage.

## Why it exists

Fitting geometry and choosing dimensions are different jobs with different failure modes. A wrong number here is a design bug a reviewer can read in the manifest; a wrong number in a mesh is a visual artifact someone has to find in a screenshot. Keeping them apart is also what lets `construction` in the public manifest be a plain readable record of what was chosen where.

## In

`resolvePlan(architecture: Architecture, design: Design, seed: number): StreetPlan`

`design` is the validated design document, [design.ts](design.ts): finish family ids, the row layout catalog, per-class and per-district overrides, and the feature rates.

## Out

`StreetPlan`, [schema.ts](schema.ts):

- `sections`: one per corridor side. The band list with its spans, the panel row layout, the finish family, and the district that governs it.
- `corners`: one per junction corner. Radius, the two tangent points, the two cut feet, the hub, the fan ray count and the accent strip widths.
- `reservations`: one per selected feature, as an along-frontage span with its depth, setback, style and kind.
- `roadways`: per corridor, the lane marking offsets, the crossing windows, the stop bar stations and the arrow stations.
- `wear`: the world-space wear zones and the per-district multiplier.

## The cross section

Atlas publishes one number per side: the reserved width. It splits, outward from the carriageway edge:

| Band | Width |
| --- | --- |
| gutter | 0.30 |
| curb | 0.20 |
| paved | reserved - 0.50 |

The paved remainder carries the panel rows. Rows are laid from the back of the curb inward, cycling one row layout until the paved width is filled: a row takes its own width when it fits, else 1 m, else 0.5 m, and a 0.5 m row is forced to 1 m modules. Each row carries a band role (edge, service, field, trim) and a finish role (base, accent, light, dark, metal).

A side whose reserved width leaves less than 1.5 m of paved width cannot carry a cross section and fails `E_UNSATISFIABLE` naming the corridor, the side and the width.

## The corner

Per junction corner, between two consecutive approaches:

- Radius: at least 6 m, otherwise the wider adjoining paved width plus 2.5 m.
- Tangent: `min(max(radius / tan(half), 2 / sin(half)), 15)`, then capped at 45 percent of either adjoining frontage, where `half` is half the interior angle. The realised radius is `tangent * tan(half)`.
- Square cuts: the paving rows on each side stop at a cut pushed outward from the tangent by `max(0, (maxPavedWidth + 2.5) / tan(half) - tangent)`, so both cuts meet at a hub behind the sidewalk instead of leaving a V at the corner. When two corners want the same frontage, each gets a share of `max(0, length - 1)`, so every frontage keeps at least 1 m of straight rows.
- Fan: the arc plus its two feet is measured and split into `round(total / 1.5)` wedges, each divided every 2 m of depth.
- Accent strips: a 0.2 m band along each cut, on the corner side, in 1 m modules.

A corner tighter than 0.6 m radius gets a square cut and no fan.

## The features

Along each frontage that faces a carriageway and runs at least 10 m, stations walk from 10 m to 6 m before the end in 8 m steps. At each station a candidate is rolled:

| Kind | Length | Depth | Rate |
| --- | --- | --- | --- |
| inlet | 2 | 0.5 | `0.13 + wear * 0.12` |
| channel | 4 at p 0.25, else 2 | 1 | `0.035 + variance * 0.045` |
| guard | 4 at p 0.3, else 2 | 0.4 | `0.07 + variance * 0.09` |
| ramp | 2 | 0.3 | 0.45, on ramp-carrying frontages, at stations where `station % 16 === 10` |

Parking is resolved first, once per frontage, on frontages at least 24 m long whose paved width is at least 6 m: 1 to 4 bays of 6 m plus 2 m diagonal ends, placed on a 2 m grid, depth 2.5 m, rate `0.3 + variance * 0.4`.

Every reservation keeps 4 m from each end of its frontage and 1 m from every other selected reservation. Unselected candidates stay in the plan, so a reviewer can see what was considered.

## Wear

Zones are seeded across the city, one per 6 districts and never fewer than 2, each a centre with a radius of 80 to 170 m and a strength of 0.65 to 1. The field at a point is the strongest zone reaching it, with a smoothstep falloff and a 0.025 baseline, times the multiplier of the district it falls in. District kind and wealth tier set that multiplier, so an industrial poor district weathers and a high-wealth downtown stays clean.

Zones are maxed, never summed, so overlapping zones cannot blow past 1.

## Invariants

- Every band span lies inside the reserved width Atlas published for its side.
- Bands are contiguous and ordered outward, and their widths sum to the reserved width exactly.
- Panel rows tile the paved width from the back of the curb with no gap and no overlap.
- A corner's tangents lie on the two frontages it joins, and its realised radius matches its tangents.
- Selected reservations on one frontage never overlap, and each keeps its clearances.
- The same architecture, design and seed give a deeply equal plan.
- No geometry: this box returns numbers, spans and points, never a ring with area.

## Errors

`E_INVALID_PARAMS` when the design fails validation, naming the field. `E_UNSATISFIABLE` when a reservation cannot carry a cross section. `E_INVARIANT` when a resolved plan fails its own coherence check.

## Dependencies

- [architecture](../architecture/CONTRACT.md) for the corridors, junctions, districts and blocks.
- [geometry](../geometry/CONTRACT.md) for the seeded hash, the frames and the arc fit.
