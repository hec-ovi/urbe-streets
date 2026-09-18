# Urbe Streets

Version 0.7.0. Builds reusable 8 m street GLBs and placements from Atlas 0.26.0 with planning reservations 2.1.0.

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

The bundle contains `manifest.json`, `streets/kit.json`, `streets/placements.json` and the referenced GLBs. Segments retain accepted panels, parking, median profiles and material surfaces. Junction arms contain crossings, approach markings and corner returns. Runs close with 4 m and 2 m pieces. Props retain their source feature identities and positions.

Engine instances the kit using placement transforms and 128 m cell addresses. Load the native material snapshot, register MeshoptDecoder, apply complete node transforms and evaluate the saved wear field in world coordinates. Indexed geometry uses quantization within 1 mm and meshopt compression. Exact ground replacement, protected station openings and delegated highways remain in the manifest. Builds use one calling thread.

Verify a city and write its size report:

```sh
npm run test:city -- --blueprint city.json --native-materials street-native.json --out new-bundle --report report.json
npm run test:compression -- --blueprint city.json
```

The report includes unique geometry, placement counts and bytes, class inventories, closure cases and a 1 km density estimate. Compression verification compares every decoded triangle with the authored geometry.

[Contract](CONTRACT.md), [kit schema](schemas/street-kit.schema.json), [placement schema](schemas/street-placement.schema.json), [box map](docs/INDEX.md), [calling guide](SKILL.md).
