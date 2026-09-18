# Construction ownership

| Construction | Box |
| --- | --- |
| District panel rows, square cuts, corner fans, parking and edge rings | [surfaces](../src/construction/surfaces/CONTRACT.md) |
| Guards, drainage, inlets, cables, marquees, tree grates and access cassettes | [hardware](../src/construction/hardware/CONTRACT.md), [features](../src/construction/features/CONTRACT.md), [district details](../src/construction/district/CONTRACT.md) |
| Wear zones and panel palette selection | [style](../src/construction/style/CONTRACT.md) |
| Paint scans, crossing layouts, lane arrows and asphalt artifacts | [markings](../src/construction/markings/CONTRACT.md) |
| Native scan bytes and effect parameters | [Materials](../../materials/sources/streets/scene-native/CONTRACT.md) |

Each construction box records source revision and file hashes. Independent fixtures check hardware buffers, crossing positions and UVs, and style and wear outputs. Atlas owns layout, parking reservations, exclusions and infrastructure. Streets fits source geometry to those public owners. Engine binds native effects and retains delegated highways and stations.
