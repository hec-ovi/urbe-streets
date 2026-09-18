# Integration review

The saved native bundle publishes exact blueprint/material identities, ground replacement and delegated highway/station ownership. Engine integration must verify texture readiness, collision admission, removal of equivalent ground/module hardware, and Dressing overlap against stable feature bounds. A freshly generated playable city must demonstrate the source street surfaces and preserved highway structures.

Atlas diagonal candidate planning is a separate coordinated responsibility. Streets consumes the existing saved reservation baseline without changing planning.

## For Engine: worker and decoder settings

`build()` defaults to `max(1, floor(availableParallelism() / 4))` owner workers, capped at the owner count. `STREETS_WORKERS` overrides that count exactly; 0 or 1 builds in the caller. Engine controls this share when assembly batches overlap.

Native pieces require `KHR_mesh_quantization` and `EXT_meshopt_compression`. Register `MeshoptDecoder` on GLTFLoader and apply the full mesh node transform for rendering and collision. Root translations carry the cell origin; child transforms decode quantized positions. Stable feature bounds and ground ownership remain in world coordinates.

## For Atlas: one owner holds half the geometry

The 500 m city's `perimeter fringe` owner wraps the whole city boundary and costs 848 ms of the 1,793 ms owner phase; the nine block owners cost 65 to 122 ms each. Owner-level parallelism cannot go below that single owner, and the fringe grows with the city perimeter. If Atlas split the perimeter reservation per city side or per block face, the fan-out would scale with the machine instead.
