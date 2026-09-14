# Urbe Streets

Version 0.2.0. Builds source-native street GLBs from saved Atlas 0.22.0 reservations, with exact ground replacement and native Materials bindings.

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

The saved bundle contains 128 m pieces, original panel/paint UVs, physical collision flags, stable hardware bounds and a native material snapshot. Consumers bind the actual referenced scans. Highways and station interactions retain explicit delegated ownership.

[Contract](CONTRACT.md), [schemas](src/schema/native-result.ts), [box map](docs/INDEX.md), [calling guide](SKILL.md).

Real-city conformance: `npm run test:city -- --blueprint blueprint.json --native-materials street-native.json --highway-baseline baseline-blueprint.json`. The input must contain corners, native parking, underpasses and stations; the baseline comparison includes complete highway structures/supports.
