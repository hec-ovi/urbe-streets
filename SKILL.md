---
name: streets
description: Build source-native street GLBs from saved Atlas reservations and native Materials bindings.
---

# Streets 0.3.1

Call `build` from `src/index.ts` with [request/options](src/schema/native-request.ts). Required: saved blueprint JSON path or parsed blueprint 0.22.0, 0.23.0 or 0.24.0, reservations 1.0.0, integer seed, design `{version:'native-1.0.0',wear:0..1}`, options.nativeMaterials binding object or path. No implicit sibling paths exist.

Use a blueprint path to preserve original file-byte identity. Object input hashes ordered JSON.stringify. Supply a new outDir with an existing parent for persisted pieces and manifest.json, or omit it for in-memory assets. Mode defaults to glb; manifest mode emits metadata with null asset/hash. Preserve source errors and owner evidence.

Consumers load the published native material snapshot, bind exact streetNativeSurface names, restore node origins, admit only streetCollision primitives, and suppress ground.replacements indices/module owners. Keep delegated highways/stations and declared shaft openings. Features provide world bounds independently of loaded cells. Complete types and error semantics: [contract](CONTRACT.md), [result](src/schema/native-result.ts).
