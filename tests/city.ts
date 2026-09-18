import { readFile, writeFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { build } from '../src/index.ts';
import { invalidParams, invariant } from '../src/errors.ts';
import type { NativeStreetBuild } from '../src/schema/native-result.ts';

const { values } = parseArgs({ options: { blueprint: { type: 'string' }, 'native-materials': { type: 'string' },
  out: { type: 'string' }, report: { type: 'string' }, compare: { type: 'string' } }, strict: true });
if (!values.blueprint || !values['native-materials']) throw invalidParams('Supply --blueprint and --native-materials, with optional --out, --report and --compare.');
const started = performance.now();
const request = (blueprint: string) => ({ blueprint, seed: 42, design: { version: 'native-1.0.0' as const, wear: 1 } });
const result = await build(request(values.blueprint),
  { nativeMaterials: values['native-materials'], ...(values.out ? { outDir: values.out } : {}) });
const kitBytes = Buffer.byteLength(JSON.stringify(result.kit));
const sample = (r: NativeStreetBuild, blueprint: string) => ({ blueprint, blueprintHash: r.meta.blueprintHash,
  ...r.statistics, ground: r.ground.cover, report: r.report });
const report = {
  version: result.meta.generatorVersion,
  pieces: result.statistics.pieces, pieceBytes: result.statistics.pieceBytes, kitBytes,
  catalogueBytes: result.statistics.pieceBytes + kitBytes,
  kitSha256: createHash('sha256').update(JSON.stringify(result.kit)).digest('hex'),
  overlayPieces: result.kit.pieces.filter(p => p.kind === 'overlay').map(p => p.id),
  samples: [sample(result, values.blueprint)],
  comparison: { performed: false, identicalKit: false, identicalPieces: false, identicalBytes: false, repeatablePlacements: false, repeatableReports: false },
  buildSeconds: 0,
};
if (values.compare) {
  const other = await build(request(values.compare), { nativeMaterials: values['native-materials'] });
  for (const path of ['streets/kit.json', ...result.kit.pieces.map(p => `streets/${p.file}`)]) {
    const bytes = values.out ? await readFile(join(values.out, path)) : result.assets[path]!;
    if (!other.assets[path] || Buffer.compare(bytes, other.assets[path]!) !== 0) throw invariant('City kits differ', { path });
  }
  if (result.statistics.pieces !== other.statistics.pieces || result.statistics.pieceBytes !== other.statistics.pieceBytes)
    throw invariant('City kit totals differ');
  report.samples.push(sample(other, values.compare));
  for (const [blueprint, reference] of [[values.blueprint, result], [values.compare, other]] as const) {
    const repeated = await build(request(blueprint), { nativeMaterials: values['native-materials'], mode: 'manifest' });
    if (JSON.stringify(reference.placements) !== JSON.stringify(repeated.placements) || reference.statistics.placements !== repeated.statistics.placements)
      throw invariant('Repeated city placements differ', { blueprint });
    if (JSON.stringify(reference.report) !== JSON.stringify(repeated.report)) throw invariant('Repeated city reports differ', { blueprint });
  }
  report.comparison = { performed: true, identicalKit: true, identicalPieces: true, identicalBytes: true, repeatablePlacements: true, repeatableReports: true };
}
report.buildSeconds = (performance.now() - started) / 1000;
if (values.report) await writeFile(values.report, JSON.stringify(report, null, 2) + '\n');
process.stdout.write(JSON.stringify(report, null, 2) + '\n');
