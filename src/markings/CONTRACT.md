# CONTRACT: markings

Purpose: paints the roadway: lane lines, stop bars, crossing fields, pedestrian stencils and the turn arrows Atlas declares legal.

## In

`buildMarkings(plan: StreetPlan, architecture: Architecture): SurfaceSet`

## Out

Flat `Surface` records at their decal order above the roadway, 1 mm apart: paint 1, bars 2, arrows 3, stencils 4.

## What it paints

- [LaneLines.ts](LaneLines.ts): an edge line each side, solid, 0.12 m wide, 0.65 m in from the carriageway edge. A centre line when the corridor carries more than one lane and no median: a solid pair 0.22 m apart making a 0.12 m gap. A dashed divider, 0.12 m wide, 3 m on and 3 m off, at each interior lane boundary Atlas published. Lines run in the window that starts 1.4 m past a crossing.
- [StopBars.ts](StopBars.ts): a pair of bars 0.24 m deep with a 0.41 m gap, across the incoming lanes only, or across the full width on a single-lane corridor.
- [Crossings.ts](Crossings.ts): the field over the roadway span Atlas named. A plain field is white bars 0.55 m wide on a pitch near 1.1 m over 2.8 m of road, fitted so whole pitches span the roadway. A bordered field, on a corridor of four lanes or more, is three rows of narrower bars with transverse border bars and two longitudinal border strips. Terminals reach the walking lanes the crossing joins, when Atlas published them.
- [Stencils.ts](Stencils.ts): one WALK or WAIT stencil per side of a crossing, 2.4 m by 0.54 m, upright from both approaches. The two perpendicular approaches at one junction read opposite states, keyed on the junction centre so a seeded roll gives them the same number and the axis test flips it.
- [TurnArrows.ts](TurnArrows.ts): one glyph per incoming lane, placed 4.7 m past a crossing, only where the marking window is longer than 20 m. The glyph is one polygon, so a lane that may go through and turn left is a single arrow with two heads. A stem 3.6 m long and 0.24 m wide, a through head reaching 1.8 m, a barb tip at 1.15 m across.

## Turn movements

An arrow is painted only from `junction.turns`. A blueprint that declares no movements gets no arrows at all, and the build reports it. An arrow that is not a declared legal movement is a traffic instruction that does not exist, so it is never guessed from geometry.

## Invariants

- Every marking lies inside the carriageway of its corridor, except a crossing terminal, which lies on the walking band.
- A lane divider sits at a lane boundary Atlas published, never at a recomputed one. Lane count and direction are read, never reinterpreted.
- A crossing field covers the roadway span its Atlas crossing names, and whole stripe pitches span it with equal margins.
- Turn arrows show exactly the movements Atlas declares legal, and no others.
- Markings start where both curbs have left their corner returns.
- Identical plan gives identical paint in the same order.

## Errors

`E_INVARIANT` when a field cannot be fitted into the span Atlas published, naming the crossing.

## Dependencies

- [plan](../plan/CONTRACT.md) for the windows, stations and offsets.
- [geometry](../geometry/CONTRACT.md) for the rectangles and the clipping.
