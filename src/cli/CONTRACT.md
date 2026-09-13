# cli

Builds a saved request and catalog into a new directory.

`npm run generate -- --request request.json --materials theme.json --out new-directory [--mode glb|manifest]`

All paths are caller supplied. Default mode: `glb`. Input: [request](../schema/request.ts). Output: [manifest](../schema/result.ts) at `manifest.json` and any referenced files under `pieces/`. Success prints counts and elapsed milliseconds. Failure prints a JSON StreetsError to stderr and exits 1.

Depends on the root `build` library entry. No implicit sibling paths.
