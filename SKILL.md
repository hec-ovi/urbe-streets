---
name: streets
description: Build reusable street GLBs and placements from saved Atlas reservations and native Materials bindings.
---

# Streets 0.7.0

Call `build` from `src/index.ts` with [request and options](src/schema/native-request.ts): blueprint 0.26.0, planning reservations 2.1.0, integer seed, design `{version:'native-1.0.0',wear:0..1}` and `options.nativeMaterials` as a binding object or JSON path.

A blueprint path preserves file byte identity. Object input hashes ordered JSON.stringify. Supply a new outDir with an existing parent for a saved bundle, or omit it for in memory assets. Default mode is `glb`. The output contains `streets/kit.json`, `streets/placements.json`, referenced GLBs and `manifest.json`. Manifest mode publishes JSON and geometry metadata without GLB files. [Kit schema](schemas/street-kit.schema.json), [placement schema](schemas/street-placement.schema.json).

Resolve piece files relative to the kit document. Instance each piece using complete GLB node transforms followed by placement transforms. Street units never scale; marking scale retains authored scan dimensions. Register MeshoptDecoder, bind exact streetNativeSurface names and sample the saved wear field at world positions. Use `hasCollision`, local bounds and the placement transform for collision.

Suppress `ground.replacements` indices and module owners. Preserve delegated highways, station interactions and shaft exclusions. Features retain world bounds and original identities. Construction and encoding run in the calling thread. Complete outputs and errors: [contract](CONTRACT.md), [result](src/schema/native-result.ts).
