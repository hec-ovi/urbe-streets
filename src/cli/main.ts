import { readFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { build, StreetsError } from '../index.ts';
import { invalidParams } from '../errors.ts';

try {
  const { values } = parseArgs({ options: { request: { type: 'string' }, materials: { type: 'string' }, out: { type: 'string' }, mode: { type: 'string', default: 'glb' } }, strict: true });
  if (!values.request || !values.materials || !values.out) throw invalidParams('Usage: npm run generate -- --request request.json --materials theme.json --out new-directory [--mode glb|manifest]');
  let request;
  try { request = JSON.parse(await readFile(values.request, 'utf8')); }
  catch { throw invalidParams('request: cannot read request JSON'); }
  const start = performance.now();
  const result = await build(request, { materials: values.materials, outDir: values.out, mode: values.mode as 'glb' | 'manifest' });
  process.stdout.write(JSON.stringify({ ...result.statistics, elapsedMs: Math.round(performance.now() - start) }) + '\n');
} catch (error) {
  const e = error instanceof StreetsError ? error : invalidParams(error instanceof Error ? error.message : String(error));
  process.stderr.write(JSON.stringify({ code: e.code, message: e.message, ...(e.details ? { details: e.details } : {}) }) + '\n');
  process.exitCode = 1;
}
