# Urbe Streets

Version 0.10.0. Builds reusable 8 m street GLBs and placements from Atlas 0.26.0 with planning reservations 2.1.0.

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

Every city publishes the complete profile catalogue in `streets/kit.json` and identical GLBs, within 200 pieces and 3 MB including kit JSON. `streets/placements.json` contains transforms and shader values for tint, wear, scan UVs and glyph indices. Widths outside the catalogue select the nearest profile and appear in `report.profiles`. A district parking bay in its rectangular notch, square or with 45 degree returns, holds one to six slots, places a 6 m strip per slot and two end returns on its saved kerb, and retains its owner finish. Road cores keep lane paint on its original grid. A parking bay the box cannot build leaves the placements, its ground keeps the ordinary segment, and `report.degraded` names the bay and the reason. Fractional remainders scale the plain 2 m closure along its run and appear in `closures`.

Engine draws whole pieces using complete GLB node transforms, placement scale, rotation and position. Paint, corner seams and zone palettes are baked. [Placement rules](CONTRACT.md) define shared overlays and shader values. Register MeshoptDecoder and bind the native material snapshot. Coverage and collision use complete transformed footprints; `report.overhangs` records accepted boundary and fringe areas. Construction runs in one calling thread.

Verify a city and write its size report:

```sh
npm run test:city -- --blueprint city.json --native-materials street-native.json --out new-bundle --report report.json
npm run test:compression -- --blueprint city.json
```

The report includes unique geometry, placement counts and bytes, class inventories, profile mappings, closure cases and accepted overhangs. Add `--compare other-city.json` to verify identical kit and GLB bytes across two cities. Compression verification compares every decoded triangle with the authored geometry.

[Contract](CONTRACT.md), [kit schema](schemas/street-kit.schema.json), [placement schema](schemas/street-placement.schema.json), [box map](docs/INDEX.md), [calling guide](SKILL.md).
