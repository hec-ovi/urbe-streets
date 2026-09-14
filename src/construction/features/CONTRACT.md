# Native street feature placement

Fits original guard, inlet and channel geometry to retained street space. `FeatureBuilder(architecture,seed,wear).plan()` returns [PlacedFeature](schema.ts) records; `draw(owner,features)` returns [SurfaceOutput](../surfaces/schema.ts); `dispose()` releases cached prototypes. No renderer or sibling runtime imports.

Retained module guard groups keep their authored stations. Additional source candidates use 8 m stations, original style choices and wear-dependent probabilities. Parking supports, crossing fields/landings, station bays/shafts and authored obstacle points exclude conflicting placements. Whole source geometry must fit; optional candidates that do not fit remain unselected. Required guard reservations fail explicitly. Inlets require matching actual road and curb interfaces. Additional guards/channels require wider sidewalks.

Each accepted feature publishes its stable source/owner/frontage IDs, full footprint and world bounds computed from the same geometry/pose, rounded outward to millimetres. These records exist independently of asset residency. Inlet/channel prototypes prove closed receiving footprints before their exact openings are cut; source models are not clipped or stretched. Drawing carries original UVs/normals and road-relative heights. `E_INVARIANT` reports unfit required source hardware or incomplete prototype coverage.

Dependencies: [architecture](../../architecture/CONTRACT.md), [hardware](../hardware/CONTRACT.md), [surfaces](../surfaces/CONTRACT.md), [style](../style/CONTRACT.md).
