# Native road markings

`Markings(architecture,seed,wear).build(owner,batch)` emits source road paint, legal lane arrows, crossing scans and asphalt wear decals. [Schema](schema.ts). Physical road ownership remains with the supplied surface batch; all marking triangles have collision disabled and claim no ground.

Atlas road frames, approach stations and legal turn IDs determine placement. Source edge and double center lines, dashed lanes, plain white bars, bordered yellow crossings, arrow silhouettes and full decal UVs retain their original dimensions. Longitudinal UV phase is selected before bounded export. Crossing marks occupy the declared receiving field. Highway paint belongs to the delegated highway renderer. Unknown nonstraight grade frames fail explicitly.

`Crosswalk(Paint,seed).build(frame,start,junction)` is the source crossing entry; `Paint` retains original coordinates and UVs for wholly received source polygons, clipping actual boundary cuts to supplied receiving rings. [Provenance](provenance.json) records the source revision and independent position/UV fixture.

Dependencies: [architecture](../../architecture/CONTRACT.md), [surfaces](../surfaces/CONTRACT.md), [style](../style/CONTRACT.md). No layout generation or renderer.
