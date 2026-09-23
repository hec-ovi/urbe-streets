---
name: streets
description: Build reusable street GLBs and placements from saved Atlas reservations and native Materials bindings.
---

# Streets 0.10.0

Call `build` from `src/index.ts` with [request and options](src/schema/native-request.ts): blueprint 0.26.0, planning reservations 2.1.0, integer seed, design `{version:'native-1.0.0',wear:0..1}` and `options.nativeMaterials` as a binding object or JSON path.

A blueprint path preserves file byte identity. Object input hashes ordered JSON.stringify. Supply a new outDir with an existing parent for a saved bundle, or omit it for in memory assets. Default mode is `glb`. The output contains `streets/kit.json`, `streets/placements.json`, referenced GLBs and `manifest.json`. Manifest mode publishes JSON and geometry metadata without GLB files. [Kit schema](schemas/street-kit.schema.json), [placement schema](schemas/street-placement.schema.json).

Resolve piece files relative to the kit document. Every plan receives the same complete catalogue and GLB bytes. Draw whole pieces using their node transforms followed by placement scale, rotation and position, as defined by the [contract](CONTRACT.md). Tint, sampled wear, scan UV offset and scale, and glyph indices are the only shader values. Paint, corner seams and zone palettes are baked; arrows, drain overlays and scans are shared overlays. Luxury and industrial-yellow frontages carry capped LED runs (start cap, segments, end cap) whose segments share the run's message on the `marquee-led` surface. `placementFootprint` returns the whole transformed footprint. Register MeshoptDecoder and bind the exact native material snapshot. `report.profiles` lists mapped widths; `report.overhangs` lists accepted boundary and fringe areas; A district bay in its rectangular notch draws N strips of 6 m and two end returns on its saved kerb, with its owner finish. `report.degraded` lists dropped parking bays with their reason.

Suppress `ground.replacements` indices and module owners. Preserve delegated highways, station interactions and shaft exclusions. Features retain world bounds and original identities. Construction and encoding run in the calling thread. Complete outputs and errors: [contract](CONTRACT.md), [result](src/schema/native-result.ts).
