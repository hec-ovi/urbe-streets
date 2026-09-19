# Issues

## Parking, 2026-09-19

Atlas 0.26.0, city `small-city-cc2a0046`, blueprint SHA256 `b9ff0ed96498cd06c85b878d95a9efc2a915928969552e37c8d472349890a351`. All 12 records in `streets.construction.reservations.parking` have square ends. Each publishes three 6 x 2 m slots, `endRun: 2`, a 22 x 2 m footprint of 44 square metres and a 26 m support. Slot pitch, ownership, walking clearance and the single occupied kerb are consistent.

The parking captures `photomode_15092026_161158.png`, `photomode_15092026_163032.png`, `photomode_15092026_163045.png` and `photomode_15092026_163142.png` show diagonal returns over 2 m. In frontage coordinates, the corresponding footprint is `[(start,0),(end,0),(end-2,2),(start+2,2)]`, area 40 square metres. Atlas owns the difference: 24 square returns and 48 square metres across these bays. Roadway ground matches each rectangular footprint exactly, and the adjacent curb and gutter records also turn at right angles. Streets preserves this geometry. Atlas must author matching diagonal ground and bands to obtain the reference ends.

Ground indices below address `volumetric.ground`; bounds are world XZ metres. Record ids retain the `parking:` prefix.

| Index | Record | Ground | Stations | Support | Footprint bounds |
| --- | --- | --- | --- | --- | --- |
| 0 | `parking:frontage:b0:0:52` | 3 | 52 to 74 | 50 to 76 | [85.7,27.1] to [107.7,29.1] |
| 1 | `parking:frontage:b0:3:56` | 39 | 56 to 78 | 54 to 80 | [28.8,90] to [30.8,112] |
| 2 | `parking:frontage:b1:0:52` | 64 | 52 to 74 | 50 to 76 | [237.5,27.1] to [259.5,29.1] |
| 3 | `parking:frontage:b2:0:56` | 108 | 56 to 78 | 54 to 80 | [386.3,27.1] to [408.3,29.1] |
| 4 | `parking:frontage:b2:3:56` | 149 | 56 to 78 | 54 to 80 | [325.4,90] to [327.4,112] |
| 5 | `parking:frontage:b3:3:52` | 188 | 52 to 74 | 50 to 76 | [28.8,249.2] to [30.8,271.2] |
| 6 | `parking:frontage:b5:3:52` | 259 | 52 to 74 | 50 to 76 | [325.4,249.2] to [327.4,271.2] |
| 7 | `parking:frontage:b6:0:52` | 284 | 52 to 74 | 50 to 76 | [85.7,335.1] to [107.7,337.1] |
| 8 | `parking:frontage:b6:3:52` | 320 | 52 to 74 | 50 to 76 | [28.8,394] to [30.8,416] |
| 9 | `parking:frontage:b7:0:52` | 345 | 52 to 74 | 50 to 76 | [237.5,335.1] to [259.5,337.1] |
| 10 | `parking:frontage:b8:0:56` | 389 | 56 to 78 | 54 to 80 | [386.3,335.1] to [408.3,337.1] |
| 11 | `parking:frontage:b8:3:52` | 430 | 52 to 74 | 50 to 76 | [325.4,394] to [327.4,416] |
