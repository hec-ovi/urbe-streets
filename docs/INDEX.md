# Streets

Version 0.9.1. Builds reusable street units and placements from a saved Atlas blueprint.

| Folder | Purpose | Dependencies | Input / output |
| --- | --- | --- | --- |
| [Streets](../CONTRACT.md) | Builds and exports street assets. | Atlas, Materials | [request](../src/schema/native-request.ts), [result](../src/schema/native-result.ts) |
| [construction](../src/construction/CONTRACT.md) | Builds reusable surfaces and original feature instances. | architecture, district, markings, surfaces, features, style, hardware | [result](../src/schema/street-kit.ts) |
| [construction/units](../src/construction/units/CONTRACT.md) | Bakes the bounded catalogue, places complete pieces and measures transformed footprints and accepted overhangs. | architecture, district, surfaces, markings, features, style, hardware, ground, assets | [input](../src/architecture/native-schema.ts), [output](../src/schema/street-kit.ts) |
| [construction/district](../src/construction/district/CONTRACT.md) | Fits uniform district panels, parking, junction transitions and street details. | architecture, surfaces, hardware | [schema](../src/construction/district/schema.ts) |
| [construction/markings](../src/construction/markings/CONTRACT.md) | Places source paint, crossing and wear details on authoritative road frames. | native architecture, surfaces, style | [schema](../src/construction/markings/schema.ts) |
| [construction/features](../src/construction/features/CONTRACT.md) | Fits source hardware to reserved street fields and publishes feature bounds. | native architecture, hardware, surfaces, style | [schema](../src/construction/features/schema.ts) |
| [construction/surfaces](../src/construction/surfaces/CONTRACT.md) | Fits source surface geometry and retains physical coverage and vertex attributes. | geometry, native architecture, style | [schema](../src/construction/surfaces/schema.ts) |
| [construction/style](../src/construction/style/CONTRACT.md) | Selects source panel rows, palettes and continuous world wear. | Source data, geometry types | [schema](../src/construction/style/schema.ts) |
| [construction/hardware](../src/construction/hardware/CONTRACT.md) | Builds source guards, inlets and drainage as geometry buffers. | Three.js geometry | [schema](../src/construction/hardware/schema.ts) |
| [architecture](../src/architecture/CONTRACT.md) | Reads Atlas 0.26.0 with planning reservations 2.1.0 and exact ground ownership. | geometry | [schema](../src/architecture/native-schema.ts) |
| [geometry](../src/geometry/CONTRACT.md) | Provides plan boolean operations and bounds. | clipper2-ts | [schema](../src/geometry/schema.ts) |
| [finishes](../src/finishes/CONTRACT.md) | Validates native scan binding snapshots. | Materials | [schema](../src/schema/native-materials.ts) |
| [ground](../src/ground/CONTRACT.md) | Checks retained surface ownership. | geometry | [result](../src/schema/native-result.ts) |
| [assets](../src/assets/CONTRACT.md) | Shares vertex and index streams, compresses GLBs and writes bundles. | geometry, glTF Transform, meshoptimizer | [result](../src/schema/native-result.ts) |
| [cli](../src/cli/CONTRACT.md) | Builds native bundles from saved request JSON. | Streets | [request](../src/schema/native-request.ts) |

[Profile catalogue](../src/construction/units/profiles.json): Atlas classes and zone dimensions.

[Native bundle schema](../src/schema/native-result.ts): exact input identity, reusable kit, placements, physical collision flags, ground replacement, native material snapshot and constructed feature bounds. [Native request](../src/schema/native-request.ts).

[API skill](../SKILL.md): calling example. [Issues](ISSUES.md): open cross-box questions. [Construction map](PORT.md): construction ownership by box.
