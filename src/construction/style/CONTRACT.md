# Native street style

Selects original panel rows/palettes and samples continuous world wear. Public entries: `WearField(options).sample(point)/snapshot()` and `PanelStyle.rows(width,seed,key)/palette(seed,ownerId,wear)`. [Schema](schema.ts), [source provenance](provenance.json).

Wear uses the saved city bounds and number of distinct ordinary through-runs, with `max(2,ceil(streets/6))` source zones. Zone centers use the original seeded keys; radii are 80..170 m, strengths 0.65..1. Samples use the maximum smooth cubic radial falloff and base 0.025, multiplied by amount 0..1. The one city field is sampled before spatial splitting; no chunk or mesh seeds exist. Snapshot includes its complete seed/domain/zones.

Rows start 0.5 m from the road edge, cover the 2/4/6 m paved width, and retain original 0.5/1/2 m widths, 1/2/4 m lengths and contrasting finishes. Palette choices use source style/palette keys scoped to stable owner IDs. Geometry owns phase, clipping, joints and exact-face UVs; Materials resolves surface names.

Invalid widths, noninteger seeds/counts, invalid bounds or wear outside 0..1 use `E_INVALID_PARAMS`. Snapshots and row results are owned copies. No layout generation, material assets or renderer dependency.
