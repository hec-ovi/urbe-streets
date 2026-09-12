# CONTRACT: hardware

Purpose: builds the solid fittings set into the street surface: inlets and grates, kerb ramps, cable troughs, guard runs, parking returns, collar bollards and access cassettes.

## Scope, and the seam left open

Hardware is what the street surface is built around: a reservation in the plan, a hole in the paving, a break in the curb. Street furniture and lighting are a later addition to this repo and do not belong here: a bin, a tree, a signal head or a lamp stands on finished paving and changes no surface. A furniture box joins the stage list beside this one and reads the same reservations.

The reference kerb ramp carries a lit message screen. The ramp body ports; the screen is an advertising surface and waits for that furniture box.

## In

`buildHardware(plan: StreetPlan, architecture: Architecture): HardwareSet`

Each reservation the plan selected becomes one model placed by one transform. A model is built once per distinct option set and reused, so a city of ten thousand inlets holds one inlet mesh.

## Out

`HardwareSet`, [schema.ts](schema.ts): `models`, each a list of parts with a mesh and a finish role, and `placements`, each naming a model and carrying a position and a rotation about +Y. `assets` instances them.

## Local frame

Every model is built at the origin in the frame the reference uses, because the numbers are authored in it: local X runs along the curb, local Z points into the sidewalk, local Y is height above the roadway. Local Y 0 lands on the roadway surface and local Z 0 on the gutter's roadway edge, so the gutter occupies Z 0 to 0.30, the curb band Z 0.30 to 0.50, and the sidewalk Z beyond 0.50.

## What it builds

- [Inlet.ts](Inlet.ts): a pan flush with the gutter floor, a slotted grate over a closed pit, and a housing filling the curb band whose mouth is the curb face itself. A 2 m unit carries 28 slots on a 0.065 m pitch. The pit is closed across its whole footprint; nothing falls through.
- [Ramp.ts](Ramp.ts): a kerb ramp across the gutter, 0.30 m of run and 0.17 m of rise from a 0.03 m roadway lip to the 0.20 m curb top, with hipped end caps that form the flare and a V groove at each body joint.
- [CableTrough.ts](CableTrough.ts): a recessed channel between two raised rails, with lid plates on a 1 m module, rail cleats on a 0.5 m module, and sagging cables.
- [Guards.ts](Guards.ts) with one file per style: a tubular loop, a cast wall 0.85 m above the pavement, a bolted frame 1.30 m high, collar bollards, a portable barrier on arched feet, and a flared pylon with a perforated head. The two cast styles are built in 2 m modules with an 8 mm joint and seeded wear; the rest are one assembly stretched to the reservation.
- [Channel.ts](Channel.ts): the inset drainage run, with a cassette divider every metre and grate bars on a 0.1 m pitch.
- [AccessCassette.ts](AccessCassette.ts): a service strip laid across the roadway curb to curb, in 0.5 m cassettes.

## Guard runs

A run is discretised, never bent: each placement consumes a 2.24 m chord of frontage and is rotated to the chord, so a run follows a corner return without a curved module. Slots cycle in sixes with three left open, so a run reads as pairs with gaps, and one slot in six is a bollard.

## Invariants

- Every placement lies inside the reservation the plan selected for it, and its footprint stays inside the reserved depth.
- A model's geometry is independent of where it is placed. The same option set gives one mesh.
- UVs are metres in the model's local frame, so one finish scan runs continuously across merged parts.
- Cast concrete is reproducible: the seeded wear hash and its constants are fixed, so the same module gives the same chips every build.
- A faceted part stays faceted and a smooth part stays smooth: the primitive choice is part of the look.
- No hardware stands on paving it did not reserve, and none blocks a crossing or a station entrance.

## Errors

`E_INVALID_PARAMS` when a reservation's length or depth is outside what a kind can build. `E_INVARIANT` when a placement escapes its reservation.

## Dependencies

- [plan](../plan/CONTRACT.md) for the reservations and their styles.
- [geometry](../geometry/CONTRACT.md) for the prisms, lofts, tubes, plates and the cast wear hash.
