# Owner construction

`new OwnerConstruction(architecture,seed,wear).build(index)` returns one reserved owner's `{meshes,coverage,panels}`, plus `features` and `snapshot()` for the manifest. It reads the whole city plan but no other owner's result, so owners build in any order. District blueprints use the district construction; source blueprints use surfaces, hardware placement and paving. [Result](OwnerConstruction.ts).

`OwnerWorkers.open(architecture,seed,wear,size)` primes `size` worker threads with the same plan and `build(index)` runs one owner on the first free thread. `width(owners)` is `max(1, floor(availableParallelism() / 4))` capped at the owner count, or exactly `STREETS_WORKERS` when that is set; 0 or 1 means the caller builds every owner itself. Vertex fields cross the thread boundary as transferred `Float64Array`, so a pooled owner is bit-identical to a local one. A worker failure rejects its owner as the same `StreetsError`, and the pool closes.

Dependencies: [architecture](../architecture/CONTRACT.md), [district](district/CONTRACT.md), [markings](markings/CONTRACT.md), [surfaces](surfaces/CONTRACT.md), [features](features/CONTRACT.md), [style](style/CONTRACT.md). Coverage, the 128 m partition and the export stay with the caller.
