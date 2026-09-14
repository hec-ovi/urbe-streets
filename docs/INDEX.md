# Streets

Builds bounded street models from a saved Atlas blueprint.

| Folder | Purpose | Dependencies | Input / output |
| --- | --- | --- | --- |
| [Streets](../CONTRACT.md) | Builds and exports street assets. | Atlas, Materials | [request](../src/schema/native-request.ts), [result](../src/schema/native-result.ts) |
| [construction/markings](../src/construction/markings/CONTRACT.md) | Places source paint, crossing and wear details on authoritative road frames. | native architecture, surfaces, style | [schema](../src/construction/markings/schema.ts) |
| [construction/features](../src/construction/features/CONTRACT.md) | Fits source hardware to reserved street fields and publishes fixed feature bounds. | native architecture, hardware, surfaces, style | [schema](../src/construction/features/schema.ts) |
| [construction/surfaces](../src/construction/surfaces/CONTRACT.md) | Fits source surface geometry and retains physical coverage and vertex attributes. | geometry, native architecture, style | [schema](../src/construction/surfaces/schema.ts) |
| [construction/style](../src/construction/style/CONTRACT.md) | Selects source panel rows, palettes and continuous world wear. | Source data, geometry types | [schema](../src/construction/style/schema.ts) |
| [construction/hardware](../src/construction/hardware/CONTRACT.md) | Builds source guards, inlets and drainage as geometry buffers. | Three.js geometry | [schema](../src/construction/hardware/schema.ts) |
| [architecture](../src/architecture/CONTRACT.md) | Reads saved Atlas ground, native reservations and infrastructure authority. | geometry | [schema](../src/architecture/native-schema.ts) |
| [geometry](../src/geometry/CONTRACT.md) | Extrudes, validates and splits polygons. | earcut, clipper2-ts | [schema](../src/geometry/schema.ts) |
| [finishes](../src/finishes/CONTRACT.md) | Resolves seeded catalog bindings. | Materials | [schema](../src/schema/native-materials.ts) |
| [ground](../src/ground/CONTRACT.md) | Checks retained surface ownership. | geometry | [result](../src/schema/native-result.ts) |
| [assets](../src/assets/CONTRACT.md) | Encodes bounded GLBs and writes bundles. | geometry, glTF Transform | [result](../src/schema/native-result.ts) |
| [cli](../src/cli/CONTRACT.md) | Builds from saved request JSON. | Streets | [request](../src/schema/request.ts) |

[Native bundle schema](../src/schema/native-result.ts): exact input identity, bounded assets, physical collision flags, ground replacement, native material snapshot and constructed feature bounds. [Native request](../src/schema/native-request.ts).

[API skill](../SKILL.md): calling example. [Issues](ISSUES.md): boundary proposals and open decisions. [Port](PORT.md): adopted construction and verification.
