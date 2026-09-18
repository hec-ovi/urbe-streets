import { writeFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { build } from '../src/index.ts';
import { readNativeAtlas } from '../src/architecture/NativeAtlas.ts';
import { invalidParams } from '../src/errors.ts';

const { values } = parseArgs({ options: { blueprint: { type: 'string' }, 'native-materials': { type: 'string' }, out: { type: 'string' }, report: { type: 'string' } }, strict: true });
if (!values.blueprint || !values['native-materials']) throw invalidParams('Supply --blueprint and --native-materials, with optional --out and --report.');
const started = performance.now();
const result = await build({ blueprint: values.blueprint, seed: 42, design: { version: 'native-1.0.0', wear: 1 } },
  { nativeMaterials: values['native-materials'], ...(values.out ? { outDir: values.out } : {}) });
const seconds = (performance.now() - started) / 1000;
const a = await readNativeAtlas(values.blueprint);
const area = (a.bounds.max[0] - a.bounds.min[0]) * (a.bounds.max[1] - a.bounds.min[1]), ratio = 1_000_000 / area;
const classes = [...new Set(result.kit.pieces.flatMap(p => p.classes))].sort();
const report = {
  blueprintHash: result.meta.blueprintHash, bounds: a.bounds,
  tiny: { ...result.statistics, buildSeconds: seconds },
  distinctPiecesPerClass: Object.fromEntries(classes.map(c => [c, result.kit.pieces.filter(p => p.classes.includes(c)).length])),
  pieceIds: Object.fromEntries([...classes, 'props'].map(c => [c, result.kit.pieces.filter(p => c === 'props' ? p.kind === 'prop' : p.classes.includes(c as typeof classes[number])).map(p => p.id)])),
  closures: result.closures,
  profiles: result.report.profiles,
  kitBytes: Buffer.byteLength(JSON.stringify(result.kit)),
  catalogueBytes: result.statistics.pieceBytes + Buffer.byteLength(JSON.stringify(result.kit)),
  estimate1km: { placementCountRatio: ratio, placements: Math.round(result.statistics.placements * ratio), placementBytes: Math.round(result.statistics.placementBytes * ratio),
    pieceBytes: result.statistics.pieceBytes, pieces: result.statistics.pieces, buildSeconds: seconds * ratio, assumption: 'The same piece inventory repeats at the measured placement density.' },
  choice: 'Every city publishes the complete profile catalogue. Paint, scan poses, wear and marquee text belong to placements.',
};
if (values.report) await writeFile(values.report, JSON.stringify(report, null, 2) + '\n');
process.stdout.write(JSON.stringify(report, null, 2) + '\n');
