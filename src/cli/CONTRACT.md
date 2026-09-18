# cli

Builds a saved native request and material binding into a new directory.

`npm run generate -- --request request.json --native-materials street-native.json --out new-directory [--mode glb|manifest]`

All paths are caller supplied. Default mode: `glb`. Input: [request](../schema/native-request.ts). Output: [manifest](../schema/native-result.ts) at `manifest.json` and the kit, placements and referenced files under `streets/`. Success prints counts and elapsed milliseconds. Failure prints a JSON StreetsError to stderr and exits 1.

Depends on the root `buildNative` library entry. No implicit sibling paths.
