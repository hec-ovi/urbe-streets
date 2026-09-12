# Box map

Proposed internal cut, by responsibility. The implementing agent adjusts it and keeps this map current.

| Box | Purpose | Dependencies | Input / output |
| --- | --- | --- | --- |
| [Streets](../CONTRACT.md) | Builds the whole city's street construction from Atlas architecture. | atlas, materials | CONTRACT.md |
| plan | Resolves a cross section, corner treatment and feature reservations per corridor side, from the Atlas reservation and district. No geometry. | none | - |
| surfaces | Fits paving cells, curbs, sloped gutters and corner fans, and owns the exact ground partition. | plan | - |
| markings | Lane lines, stop bars, crossing fields, pedestrian stencils and turn arrows. | plan | - |
| hardware | Inlets, grates, ramps, cable troughs, guardrails and parking bays. | plan | - |
| finishes | Binds finish families from the materials box, and places wear zones and surface artifacts by district. | materials | - |
| assets | Splits construction into streamable pieces, writes the models and the manifest. | surfaces, markings, hardware, finishes | - |
| preview | Local viewer for one generated city. | assets | - |

Reference implementation for surfaces, markings, hardware and finishes: the `district`, `furniture` and `materials` boxes of the sibling `threejsscene` project. Its `generation` box is Atlas's job and does not port.
