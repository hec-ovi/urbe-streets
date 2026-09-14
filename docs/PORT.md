# Source construction

| Source responsibility | Streets box |
| --- | --- |
| District panel rows, square cuts, corner fans, parking and edge rings | [surfaces](../src/construction/surfaces/CONTRACT.md) |
| Furniture guards, drainage, inlets and access cassettes | [hardware](../src/construction/hardware/CONTRACT.md), [placement](../src/construction/features/CONTRACT.md) |
| Wear zones and panel palette selection | [style](../src/construction/style/CONTRACT.md) |
| Paint scans, crossing layouts, lane arrows and asphalt artifacts | [markings](../src/construction/markings/CONTRACT.md) |
| Native scan bytes and effect parameters | [Materials](../../materials/sources/streets/scene-native/CONTRACT.md) |

Each construction box records source revision/file hashes. Independent source fixtures check hardware geometry buffers, crossing positions/UVs and style/wear outputs. Atlas owns layout, parking reservations, exclusions and infrastructure. Streets fits source geometry to those public owners; Engine binds native effects and retains delegated highways/stations.
