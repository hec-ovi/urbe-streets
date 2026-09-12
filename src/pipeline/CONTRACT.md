# CONTRACT: pipeline

Purpose: composes the one pass over the city and is what the public `build` entry calls.

## In

`build(request: StreetRequest, options?: BuildOptions): Promise<StreetBuild>`

This is the repo's public entry, re-exported from [src/index.ts](../index.ts). Its shape is the streets [CONTRACT.md](../../CONTRACT.md).

## The pass

1. `architecture` reads and gates the blueprint.
2. `plan` resolves every cross section, corner and reservation.
3. `surfaces`, `ground`, `markings` and `hardware` build from that one plan, independently.
4. `finishes` binds the keys and places the artifacts.
5. `assets` splits into pieces and writes.

Stage three is where the work is, and its four boxes share no state beyond the plan, so the stage is order independent by construction.

## Progress

`options.onProgress` receives completed stages and the current phase. Counts measure completed stages, not elapsed time, and observation changes no output byte.

## Invariants

- One pass over the whole city, never per request.
- The same request, design and seed give a byte-identical manifest and byte-identical assets.
- A stage failure propagates its own `StreetsError` unchanged. This box adds no error codes of its own.
- No stage mutates the plan.

## Dependencies

Every stage box above.
