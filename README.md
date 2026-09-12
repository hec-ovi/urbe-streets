# urbe streets

Builds a city's street surfaces from an Atlas city blueprint: paving, curbs, gutters, corner returns, lane markings, crossing fields, parking bays, guardrails and surface wear, as model assets plus a manifest.

Atlas decides where a corridor runs, how wide it is reserved, how many lanes it carries and where people walk and cross. This box decides every physical surface inside that reservation: the band layout, the panel rows, the finishes per district and tier, the gutter profile and its hardware, the corner treatment, and the markings that match the turns Atlas declares legal.

One pass over the whole city emits many streamable pieces, because a 10 km city cannot be one model.

[Contract](CONTRACT.md) is the coupling surface. [Box map](docs/INDEX.md) lists the internal boxes.

## Status

Contract draft. No implementation yet.
