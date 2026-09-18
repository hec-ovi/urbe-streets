# Urbe Streets

Version 0.8.0. Builds reusable 8 m street GLBs and placements from Atlas 0.26.0 with planning reservations 2.1.0.

```sh
npm ci
npm run build
npm test
```

```js
import { build } from './src/index.ts';
const result = await build({
  blueprint: 'blueprint.json', seed: 42,
  design: { version: 'native-1.0.0', wear: 1 }
}, { nativeMaterials: 'street-native.json', outDir: 'street-bundle' });
console.log(result.statistics);
```

```sh
npm run generate -- --request request.json --native-materials street-native.json --out new-bundle
```

Every city publishes the complete profile catalogue in `streets/kit.json` and identical GLBs, within 200 pieces and 3 MB including kit JSON. `streets/placements.json` contains city poses, receiving clips and per instance paint, scans, wear and text. Widths outside the catalogue select the nearest profile and appear in `report.profiles`. Fractional remainders scale the plain 2 m closure along its run and appear in `closures`.

Engine applies configuration selection, complete GLB node transforms, local offset, closure scale, rotation, translation and receiving clips. [Placement rules](CONTRACT.md) cover palette regions, openings, overlays and collision. Register MeshoptDecoder, bind the native material snapshot and evaluate wear in world coordinates. Construction runs in one calling thread.

Verify a city and write its size report:

```sh
npm run test:city -- --blueprint city.json --native-materials street-native.json --out new-bundle --report report.json
npm run test:compression -- --blueprint city.json
```

The report includes unique geometry, placement counts and bytes, class inventories, profile mappings, closure cases and a 1 km density estimate. Compression verification compares every decoded triangle with the authored geometry.

[Contract](CONTRACT.md), [kit schema](schemas/street-kit.schema.json), [placement schema](schemas/street-placement.schema.json), [box map](docs/INDEX.md), [calling guide](SKILL.md).
