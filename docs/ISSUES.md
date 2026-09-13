# Boundary proposals

The executable 0.1.0 path materializes saved Atlas construction. The complete Streets-owned district builder remains open.

| Proposal | Why | Affected boxes |
| --- | --- | --- |
| Publish versioned reservations with frontage ownership, junction approaches/tangents, permitted corner land, lane offsets, legal turns, walking terminals and explicit zero sides. | Current Atlas 0.21.0 publishes physical construction. The Three.js district builder computes its own plot outline, core, corner land and routing; using that planner would change Atlas decisions. One adapter isolates the current format. | Atlas, Streets, Engine |
| Publish the shared dimensional profile, then add dimensioned profiles, module/row choices, district overrides and feature probabilities to Streets design input. | These fields require agreed dimensions and land. The implemented design controls material choices only. | Atlas, Streets, Materials, Exterior, Interior |
| Coordinate the source-ground handoff with Engine. | Engine's inspected root contract has no Streets dependency. This build must become its street render/collision authority before integration can be verified. | Streets, Engine |
| Publish highway envelope and support ownership. | Deck height, clearance, maximum grade and support footprint rules need agreement. Highway builds return an unsupported-architecture error. | Atlas, Streets, Exterior, Engine |
| Publish station reservation and interaction schema. | Stairs, terminal/display/arrival anchors and travel ownership need one boundary. Station builds return an unsupported-architecture error. | Atlas, Streets, Naming, Engine |
| Publish water and station exclusions in the reservation interface. | A surface builder needs explicit land ownership across all levels. Hydrology builds return an unsupported-architecture error. | Atlas, Streets, Engine |
| Publish furniture, light and model-catalog attachments. | Reusing the detailed source furniture requires valid placement/support footprints and an agreed delivery scope. Module hardware is retained; new fittings and furniture are absent. | Streets, Materials, Engine |
| Publish source material bindings and supported runtime effects. | The source uses Three.js node shaders for asphalt blending, wear, paint erosion and screens. Current GLBs supply catalog references and UVs; those shaders and source appearance are not ported. | Materials, Streets, Engine |

## Open decisions

Stage section 16 remains unresolved in full:

1. Shared lane, clear/total sidewalk, joint, gutter, parking and crossing dimensions.
2. Final reservation and route schema.
3. Permitted corner-fitting land.
4. Station planning depth and possible underground modeling.
5. Highway parameters and small-city station separation policy.
6. Station/furniture/light output extension.
7. Remaining Three.js corrections and visual acceptance.
8. Whether row composition can change along one face.
9. First-delivery furniture and planting scope.
10. Entrance-only versus underground track/platform scope.
11. Diagonal corner measurements.
12. Constant lane multiples versus 4/7/14 m carriageways.
13. Absolute highway deck height.
14. Rounded-corner module pitch.

Full district geometry, rounded/cut returns chosen by Streets, parking selection, inlets, channels, ramps, guard families, wear, material appearance, a walking preview and Engine integration require the boundaries above. No independent reconstruction of Atlas planning is included.
