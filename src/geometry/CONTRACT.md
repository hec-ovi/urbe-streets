# Geometry operations

Boolean operations, orientation and bounds for metre-based XZ rings. [Types](schema.ts). [Public functions](polygons.ts): area, bounds, intersects, rectangle, union, intersection, difference and totalArea. Boolean operations use eight decimal places; untouched source rings retain their original coordinates. Returns rings, bounds, signed areas and intersection predicates. Depends on clipper2-ts. Native surface triangulation and 3D buffers belong to [surfaces](../construction/surfaces/CONTRACT.md).
