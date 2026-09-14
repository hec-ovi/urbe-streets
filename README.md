# Urbe Streets

Version0.2.0. Builds source-native street GLBs from saved Atlas0.22.0 reservations, with exact ground replacement and native Materials bindings.

```sh
npm ci
npm run build
npm test
```

```js
import { buildNative } from './src/native.ts';
const result = await buildNative({
  blueprint: 'blueprint.json', seed: 42,
  design: { version: 'native-1.0.0', wear: 1 }
}, { nativeMaterials: 'street-native.json', outDir: 'street-bundle' });
console.log(result.statistics);
```

The saved bundle contains128m pieces, original panel/paint UVs, physical collision flags, stable hardware bounds and a native material snapshot. Consumers bind the actual referenced scans. Highways and station interactions retain explicit delegated ownership.

[Contract](CONTRACT.md), [schemas](src/schema/native-result.ts), [box map](docs/INDEX.md), [calling guide](SKILL.md).
