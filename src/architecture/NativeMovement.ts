import { bad, array, number, object, path, point, records, ring, string, indexed, type RecordValue } from './values.ts';
import type { NativeApproach, NativeLane, NativeRoad, NativeTurn } from './native-schema.ts';

export function nativeMovement(source: RecordValue): { roads: NativeRoad[]; approaches: NativeApproach[]; turns: NativeTurn[] } {
  const streets = object(source.streets, 'streets'), construction = object(streets.construction, 'streets.construction');
  const architecture = object(source.architecture, 'architecture');
  if (architecture.version !== '1.0.0') bad('architecture.version', 'Movement architecture 1.0.0 is required');
  const nodes = indexed(records(streets.nodes, 'streets.nodes'), 'streets.nodes');
  const edgeRows = indexed(records(streets.edges, 'streets.edges'), 'streets.edges');
  const laneRows = indexed(records(architecture.edges, 'architecture.edges'), 'architecture.edges', 'edgeId');
  const runs = new Map<string, { id: string; start: number; forward: boolean }>();
  for (const run of records(construction.runs, 'construction.runs')) for (const member of records(run.edges, 'run.edges')) {
    const edgeId = string(member.edgeId, 'run.edgeId');
    if (runs.has(edgeId) || !edgeRows.has(edgeId) || typeof member.forward !== 'boolean') bad('construction.runs', 'Invalid run edge membership');
    runs.set(edgeId, { id: string(run.id, 'run.id'), start: number(member.start, 'run.start'), forward: member.forward });
  }
  const laneIds = new Set<string>();
  const roads: NativeRoad[] = [...edgeRows].map(([id, e]) => {
    const from = string(e.from, `edges.${id}.from`), to = string(e.to, `edges.${id}.to`), kind = string(e.class, `edges.${id}.class`) as NativeRoad['kind'];
    if (!nodes.has(from) || !nodes.has(to) || !['street', 'road', 'highway', 'alley'].includes(kind)) bad(`edges.${id}`, 'Invalid road endpoints or class');
    const authority = laneRows.get(id), run = runs.get(id);
    if (!authority || !run) bad(`edges.${id}`, 'Missing lane or run authority');
    const width = number(e.width, `edges.${id}.width`);
    if (width <= 0) bad(`edges.${id}.width`, 'Road width must be positive');
    if (kind !== 'highway' && (e.level !== 0 || records(e.elevationProfile, `edges.${id}.elevationProfile`).some(knot => knot.level !== 0))) bad(`edges.${id}`, 'Native ordinary ground requires an at-grade road datum');
    const lanes: NativeLane[] = records(authority.lanes, `architecture.edges.${id}.lanes`).map(lane => {
      const laneId = string(lane.id, 'lane.id'), laneWidth = number(lane.width, 'lane.width'), offset = number(lane.offset, 'lane.offset');
      if (laneIds.has(laneId) || !['forward', 'backward'].includes(String(lane.direction)) || laneWidth <= 0 || Math.abs(offset) + laneWidth / 2 > width / 2 + 1e-8) bad(`architecture.edges.${id}`, 'Invalid declared driving lane');
      laneIds.add(laneId);
      return { id: laneId, width: laneWidth, offset, direction: lane.direction as NativeLane['direction'], path: path(lane.path, 'lane.path') };
    });
    if (kind !== 'alley' && ![1, 2, 4].includes(lanes.length)) bad(`architecture.edges.${id}.lanes`, 'Native profiles require one, two or four declared lanes');
    const districtStyle = e.districtStyle;
    if (districtStyle !== undefined && districtStyle !== 'luxury' && districtStyle !== 'industrial' && districtStyle !== 'ordinary') bad(`edges.${id}.districtStyle`, 'Unknown district road style');
    const median = e.crossSection === undefined ? undefined : object(e.crossSection, `edges.${id}.crossSection`).median;
    const medianWidth = median === undefined ? undefined : number(object(median, `edges.${id}.median`).width, `edges.${id}.median.width`);
    if (medianWidth !== undefined) {
      const ordered = [...lanes].sort((a, b) => b.offset - a.offset);
      if (medianWidth <= 0 || kind !== 'road' || ordered.length !== 4
        || ordered[0]!.direction !== ordered[1]!.direction || ordered[2]!.direction !== ordered[3]!.direction
        || ordered[0]!.direction === ordered[2]!.direction
        || ordered.some((lane, index) => index < 2 ? lane.offset - lane.width / 2 < medianWidth / 2 - 1e-8
          : lane.offset + lane.width / 2 > -medianWidth / 2 + 1e-8)) bad(`edges.${id}.median`, 'Median reservation conflicts with its avenue lanes');
    }
    return { id, from, to, kind, width, lanes, path: path(e.path, `edges.${id}.path`), runId: run.id, runStart: run.start, runForward: run.forward,
      ...(districtStyle === undefined ? {} : { districtStyle }),
      ...(medianWidth === undefined ? {} : { medianWidth }) };
  });
  const turns: NativeTurn[] = [];
  for (const n of records(architecture.nodes, 'architecture.nodes')) {
    const nodeId = string(n.nodeId, 'architecture.nodeId'); if (!nodes.has(nodeId)) bad('architecture.nodeId', 'Unknown movement node');
    for (const turn of records(n.turns, 'architecture.turns')) {
      const fromLaneId = string(turn.fromLaneId, 'turn.fromLaneId'), toLaneId = string(turn.toLaneId, 'turn.toLaneId');
      const kind = string(turn.kind, 'turn.kind') as NativeTurn['kind'];
      if (!laneIds.has(fromLaneId) || !laneIds.has(toLaneId) || !['through', 'left', 'right', 'u-turn'].includes(kind)) bad('architecture.turns', 'Unknown lane or turn');
      turns.push({ nodeId, fromLaneId, toLaneId, kind, level: number(turn.level, 'turn.level') });
    }
  }
  const approaches: NativeApproach[] = [];
  for (const junction of records(construction.junctions, 'construction.junctions')) {
    const id = string(junction.id, 'junction.id');
    for (const [i, a] of records(junction.approaches, 'junction.approaches').entries()) {
      const nodeId = string(a.nodeId, 'approach.nodeId'), edgeId = string(a.edgeId, 'approach.edgeId');
      if (!nodes.has(nodeId) || !edgeRows.has(edgeId)) bad(`junctions.${id}`, 'Unknown approach node or edge');
      const landings = object(a.landings, 'approach.landings'), walking = object(a.walkingLandings, 'approach.walkingLandings');
      approaches.push({ id: `${id}:${i}`, nodeId, edgeId, distance: number(a.distance, 'approach.distance'), station: point(a.station, 'approach.station'),
        field: ring(a.field, 'approach.field'), landings: [...Object.values(landings), ...Object.values(walking)].map((p, k) => ring(p, `approach.landings[${k}]`)) });
    }
  }
  // Keep declared crossing identities readable even though Streets fits its own paint inside their fields.
  for (const crossing of records(streets.crossings, 'streets.crossings')) {
    if (!nodes.has(string(crossing.nodeId, 'crossing.nodeId'))) bad('streets.crossings', 'Unknown crossing node');
    for (const segment of records(crossing.segments, 'crossing.segments')) {
      if (!edgeRows.has(string(segment.edgeId, 'crossing.edgeId'))) bad('streets.crossings', 'Unknown crossing edge');
      array(segment.markings, 'crossing.markings').forEach((r, i) => ring(r, `crossing.markings[${i}]`));
    }
  }
  return { roads, approaches, turns };
}
