# Changelog

0.13.0: the manifest drops `report.overhangs`: every surface piece stands only on saved ground, so its boundary and fringe areas were always zero, and a repeated surface already fails the build.

0.12.1: a highway's grade corridor is built from the unpainted closures of its road profile, with ordinary arms at grade junction boxes and an end at each saved underpass kerb line, instead of plain concrete infill.

0.12.0: a junction return is the crossing street's far kerb, so tees and outer corners fit their saved ground; median profiles leave the island band open and saved islands are built from 2 m noses and 2 m and 8 m units at their Atlas stations; leftover carriageway infill takes asphalt or district-hex, both world sampled; the piece budget is 216.

0.11.0: grade runs continue through underpasses; whole pieces require matching saved roles and levels, with unpainted source infill for the remainder; junction arms meet run starts, crossing and stop paint follows Atlas, and raised lane intrusion or positive surface overlap fails; capped LED runs respect fitted closures as complete runs.

0.10.0: luxury and industrial-yellow frontages, underpass grade sides and frontages under a highway included, carry capped LED runs (start cap, 2 m or 1 m segments, end cap) midway between drains and on parking strips, or in the middle of the widest clear stretch of a frontage the drain grid leaves bare, clear of drains, cables, access points and crossings; segment LED fields use the `marquee-led` surface with metre UVs; each district drain station is one inlet with a flush grate and curb throats under a tread-only overlay; new marquee surfaces fall back to existing ones until the binding carries them; drain tread inserts publish one 0 to 1 UV square over their 2 x 2 m; a parking bay whose footprint returns 45 degrees inside its rectangular notch (Atlas 0.12.3) is built like a square one.

0.9.4: parking follows saved kerbs with 6 m slots, complete end returns and block finishes.

0.9.3: placement, coverage, detail and decal checks query a uniform box grid, so a 3 x 3 km plan builds in about nine seconds.

0.9.2: a parking bay holds one to six slots and places one 8 m parking piece per slot on its run.

0.9.1: a parking bay the box cannot build is dropped, its ground keeps the ordinary segment, and `report.degraded` names the bay and the reason.

0.9.0: Streets bakes paint, junction seams and zone palettes into a shared kit with overlay pieces, transform placements and reported overhangs.

0.8.0: Streets publishes one bounded profile catalogue with shared geometry, placement attributes and reported width mappings.

0.7.1: Streets closes fractional runs with plain fitted paving and curbs and records their lengths.

0.7.0: Streets publishes reusable 8 m pieces, fitted closures, junctions, original prop placements and marking instances with manifest 0.3.0.

0.6.0: Streets accepts Atlas 0.26.0 with planning reservations 2.1.0 and builds surfaces from exact ground ownership.

0.5.0: native GLBs use shared vertices, bounded quantization and required meshopt compression.

0.4.0: ground ownership, road frames, detail placement and parcel checks resolve by bounds.

0.3.1: proud cable sockets and world-scaled asphalt parking outside luxury districts.

0.3.0: district panels, 2 m parking, junction transitions, crossing ramps, median grates, subtle hexagons and LED marquee geometry.

0.2.1: explicit Atlas 0.22.0/0.23.0 input identity with reservation 1.0.0.

0.2.0: source-native street geometry, scan bindings, bounded collision assets, exact ground replacement, continuous wear and delegated highway/station ownership.
