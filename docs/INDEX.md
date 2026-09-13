# Streets

Builds bounded street models from a saved Atlas blueprint.

| Folder | Purpose | Dependencies | Input / output |
| --- | --- | --- | --- |
| [Streets](../CONTRACT.md) | Builds and exports street assets. | Atlas, Materials | [request](../src/schema/request.ts), [result](../src/schema/result.ts) |
| [architecture](../src/architecture/CONTRACT.md) | Reads current Atlas geometry in one adapter. | geometry | [schema](../src/architecture/schema.ts) |
| [geometry](../src/geometry/CONTRACT.md) | Extrudes, validates and splits polygons. | earcut, clipper2-ts | [schema](../src/geometry/schema.ts) |
| [finishes](../src/finishes/CONTRACT.md) | Resolves seeded catalog bindings. | Materials | [schema](../src/schema/materials.ts) |
| [ground](../src/ground/CONTRACT.md) | Checks retained surface ownership. | geometry | [result](../src/schema/result.ts) |
| [assets](../src/assets/CONTRACT.md) | Encodes bounded GLBs and writes bundles. | geometry, glTF Transform | [result](../src/schema/result.ts) |
| [cli](../src/cli/CONTRACT.md) | Builds from saved request JSON. | Streets | [request](../src/schema/request.ts) |

[API skill](../SKILL.md): calling example. [Issues](ISSUES.md): boundary proposals and open decisions. [Port](PORT.md): adopted construction and verification.
