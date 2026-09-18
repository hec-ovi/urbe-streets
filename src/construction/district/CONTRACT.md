# District construction

Builds the published district street format from its exact Atlas owners and supports.

`DistrictRoads`, `DistrictPaving` and `CrossingRamps` take [NativeArchitecture](../../architecture/native-schema.ts) and write accepted surfaces to [SurfaceBatch](../surfaces/CONTRACT.md). `DistrictDetails` plans original [features](schema.ts); `dispose()` releases its hardware models. The [unit construction](../units/CONTRACT.md) clips receiving fields and instances these surfaces and props.

Block palettes apply to all four sides. Straight paving repeats four 1 m panels, one 2 m panel and a 0.2 m inner separator. Curved rows retain the same radial widths. Parking of 2 m depth fits its saved bay and keeps the inner panel band. Luxury road and parking hexagons use world coordinates; industrial roads use asphalt. A distinct central surface joins the four approach styles at junctions.

Settings in [settings.json](settings.json) select drain, marquee and cable intervals. Candidates fit complete source footprints and avoid crossings, stations, parking returns and access points. Drains align with a 2 x 2 m tread insert. Marquees use framed sloping housings and fitted glyphs; blue parking has an illuminated road edge. Median surfaces retain their source footprint and ornament reservations. Framed tree grates share the tree anchors consumed by Engine. Crossing ramps carry a hexagonal surface from the first outer panel row across the curb/gutter to the road.

Every receiving field remains covered exactly once by source-owned ground. Geometry may be cut to that field; it never creates a second land owner. Unsupported or uncovered source data fails with Streets errors. No renderer or sibling runtime imports.
