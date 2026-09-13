---
name: streets
description: Build streamable street GLBs from a saved Atlas blueprint and a Materials catalog using the Streets library or CLI.
---

# Streets 0.1.0

Builds bounded street models from saved Atlas construction, preserving its ground ownership and dimensions.

Library: `import { build } from './src/index.ts'`. CLI: `npm run generate -- --request request.json --materials theme.json --out new-directory`.

| Request field | Default |
| --- | --- |
| `blueprint` | Required saved Atlas 0.21.0 blueprint; at-grade construction only |
| `design.version` | Required caller-owned version string |
| `design.finishes` | Required role-to-Materials-key map; arrays allow seeded choice |
| `seed` | Required safe integer |
| `options.materials` | Required parsed theme catalog or path to theme.json |
| `options.outDir` | Omitted: return asset bytes in memory |
| `options.mode` | `glb`; `manifest` returns records with null asset paths |

Supported roles and complete shapes: [request schema](src/schema/request.ts). Supply every used role. Source modules control geometry; this call does not design a new street plan.

Copyable export example from the repository root:

```js
import { readFile } from 'node:fs/promises';
import { build } from './src/index.ts';
const request = JSON.parse(await readFile('examples/request.json', 'utf8'));
const result = await build(request, { materials: 'examples/catalog.json' });
console.log(result.pieces.length, result.ground.cover);
```

This example uses synthetic construction and placeholder map references. For rendering, supply the caller's real Materials catalog and matching finish keys. Consumers bind the maps named by `textures.bindings`.

Response: versioned `pieces`, exact retained `ground`, selected `construction`, `textures`, `capabilities`, counts and in-memory GLB `assets`. With `outDir`, assets are written and the returned asset map is empty. See [result schema](src/schema/result.ts).

Errors: `E_INVALID_PARAMS` (request, catalog or IO), `E_UNSUPPORTED_ARCHITECTURE` (version, geometry or feature), `E_UNSATISFIABLE` (reservation/material mismatch), `E_INVARIANT` (construction coherence). Keep the error details and input for the producer. Do not change Atlas dimensions to get a build through validation. Highways, stations and hydrology require the proposals in [ISSUES.md](docs/ISSUES.md).
