# CONTRACT: cli

Purpose: takes a saved Atlas blueprint on the command line and writes a build to a directory.

## In

    npm run build -- --blueprint <city.json> --out <dir> [options]

| Option | Meaning |
| --- | --- |
| `--blueprint <file>` | a saved Atlas blueprint, required |
| `--out <dir>` | the output directory, required |
| `--design <file>` | a design document; the default design is used when omitted |
| `--seed <int>` | the seed Streets owns, default 1 |
| `--materials <dir>` | the materials catalog, default the sibling materials box |
| `--mode <glb\|manifest>` | asset mode, default `glb` |
| `--quiet` | no progress output |

## Out

The build in `--out`: `manifest.json` plus one model per piece under `pieces/`. On success it prints one line with the piece count, the ground owner count, the covered area and the elapsed time. On failure it prints the error code and message and exits non-zero.

## Invariants

- No path from a user's home directory is hardcoded. The materials default is resolved relative to this repo.
- The same arguments give the same output bytes.
- Exit code 0 only when the manifest and every piece it names were written.

## Dependencies

- [pipeline](../pipeline/CONTRACT.md).
