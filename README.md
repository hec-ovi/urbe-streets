# Urbe Streets

Version 0.1.0. Builds bounded GLB street assets from saved Atlas 0.21.0 construction, with retained ground ownership and seeded Materials bindings.

```sh
npm ci
npm run build
npm test
npm run generate -- --request examples/request.json --materials examples/catalog.json --out out-example
```

The example is synthetic geometry with a catalog-reference fixture. It exercises export; its map paths are placeholders. Supply a real Materials theme catalog and matching design keys for rendering.

The supported build imports at-grade ground and physical modules, preserving panels, joints, curbs, gutters, module hardware and published crossing paint. It emits 128 m spatial pieces. Consumers bind the referenced catalog maps. Highways, subway stations and hydrology are rejected explicitly.

[API skill](SKILL.md) explains library calls and defaults. [Contract](CONTRACT.md) links the schemas. [Box map](docs/INDEX.md) lists responsibilities. [Issues](docs/ISSUES.md) lists the district-construction and integration work requiring coordination.
