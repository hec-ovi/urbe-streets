# Integration review

The saved native bundle publishes exact blueprint/material identities, ground replacement and delegated highway/station ownership. Engine integration must verify texture readiness, collision admission, removal of equivalent ground/module hardware, and Dressing overlap against stable feature bounds. A freshly generated playable city must demonstrate the source street surfaces and preserved highway structures.

Atlas diagonal candidate planning is a separate coordinated responsibility. Streets consumes the existing saved reservation baseline without changing planning.

## For Engine: the streets build now takes threads

`build()` spreads owners over `availableParallelism() - 1` worker threads by default (500 m city, 24 edges, 18 owners: 2.96 s in one thread, 2.26 s on eight workers; both bundles byte-identical). Engine runs it from `src/assembly/streets-worker.js`, so the pool nests inside that worker. If a world build ever overlaps the exterior shell batch with the streets phase, set `STREETS_WORKERS` to the share Engine wants streets to hold; the contract honours the value exactly, and 0 or 1 keeps everything in the calling thread.

## For Atlas: one owner holds half the geometry

The 500 m city's `perimeter fringe` owner wraps the whole city boundary and costs 848 ms of the 1,793 ms owner phase; the nine block owners cost 65 to 122 ms each. Owner-level parallelism cannot go below that single owner, and the fringe grows with the city perimeter. If Atlas split the perimeter reservation per city side or per block face, the fan-out would scale with the machine instead.
