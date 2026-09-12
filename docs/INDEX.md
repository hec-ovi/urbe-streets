# Box map

One pass over a city blueprint becomes streamable street assets. The boxes below are the stages of that pass, cut by responsibility.

| Box | Purpose | Dependencies | Input / output |
| --- | --- | --- | --- |
| [Streets](../CONTRACT.md) | Builds the whole city's street construction from Atlas architecture. | architecture, pipeline | [CONTRACT.md](../CONTRACT.md) |
| [architecture](../src/architecture/CONTRACT.md) | Reads a saved Atlas blueprint, gates its version and normalizes it into the one internal architecture model every other box reads. | geometry | [schema](../src/architecture/schema.ts) |
| [geometry](../src/geometry/CONTRACT.md) | Exact 2D and 3D primitives: rings, offsets, arcs, booleans, triangulation, prisms, lofts, sloped plates, tubes, and deterministic mesh buffers on the 1 mm grid. | clipper2-ts, earcut | [schema](../src/geometry/schema.ts) |
| [plan](../src/plan/CONTRACT.md) | Resolves the cross section per corridor side, the corner treatment per junction corner, and the feature reservations along each frontage. Numbers and intervals, no geometry. | architecture | [schema](../src/plan/schema.ts) |
| [surfaces](../src/surfaces/CONTRACT.md) | Fits the paving cells, curbs, sloped gutters, corner returns, roadway slabs and block frontage from a resolved plan. | plan, geometry | [schema](../src/surfaces/schema.ts) |
| [ground](../src/ground/CONTRACT.md) | Owns the exact disjoint partition of all street land, the sole render and collision authority for street surfaces. | plan, geometry | [schema](../src/ground/schema.ts) |
| [markings](../src/markings/CONTRACT.md) | Lane lines, stop bars, crossing fields, pedestrian stencils and the turn arrows Atlas declares legal. | plan, geometry | [schema](../src/markings/schema.ts) |
| [hardware](../src/hardware/CONTRACT.md) | Inlets and grates, kerb ramps, cable troughs, guard runs, parking bay returns, collar bollards and access cassettes. | plan, geometry | [schema](../src/hardware/schema.ts) |
| [finishes](../src/finishes/CONTRACT.md) | Binds finish families to materials keys, and places wear zones and surface artifacts by district. | plan, geometry, materials | [schema](../src/finishes/schema.ts) |
| [assets](../src/assets/CONTRACT.md) | Splits construction into bounded streamable pieces and writes the models and the manifest. | finishes, geometry | [schema](../src/assets/schema.ts) |
| [pipeline](../src/pipeline/CONTRACT.md) | Composes the one pass and is what the public `build` entry calls. | every stage above | [schema](../src/pipeline/schema.ts) |
| [cli](../src/cli/CONTRACT.md) | Takes a saved Atlas blueprint on the command line and writes a build to a directory. | pipeline | [CONTRACT.md](../src/cli/CONTRACT.md) |
| [preview](../src/preview/CONTRACT.md) | Local viewer for one generated city, laid out from JSON. | assets output | [schema](../src/preview/schema.ts) |

Stage order in the pass: architecture, plan, surfaces and ground and markings and hardware, finishes, assets.

## Where the construction comes from

`surfaces`, `markings`, `hardware`, the `geometry` primitive layer and the finish families port from the sibling `threejsscene` project (Three.js Scene Studio): its `scene/street/district/`, `scene/street/furniture/` and `scene/materials/` boxes. Its `scene/street/generation/` box does not port; that is seeded city planning and Atlas owns it.

Furniture and lighting are a later addition. `hardware` holds only what is built into the street surface; a furniture box joins the stage list beside it.
