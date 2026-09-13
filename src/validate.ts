import { invalidParams } from './errors.ts';
import type { StreetRequest, BuildOptions } from './schema/request.ts';

const record = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v);
const exactKeys = (v: Record<string, unknown>, allowed: string[], field: string): void => {
  const unknown = Object.keys(v).find(k => !allowed.includes(k));
  if (unknown) throw invalidParams(`${field}.${unknown}: unsupported field`);
};
export function validate(request: unknown, options: unknown): asserts request is StreetRequest {
  if (!record(request)) throw invalidParams('request: expected object');
  exactKeys(request, ['blueprint', 'design', 'seed'], 'request');
  if (!Number.isSafeInteger(request.seed)) throw invalidParams('seed: expected a safe integer');
  const design = request.design;
  if (!record(design) || typeof design.version !== 'string' || !design.version.length || !record(design.finishes)) throw invalidParams('design: version and finishes are required');
  exactKeys(design, ['version', 'finishes'], 'design');
  exactKeys(design.finishes, ['roadway', 'panel', 'joint', 'curb', 'gutter', 'gutter-lip', 'guardrail', 'marking'], 'design.finishes');
  for (const [role, value] of Object.entries(design.finishes)) {
    const keys = typeof value === 'string' ? [value] : value;
    if (!Array.isArray(keys) || !keys.length || keys.some(v => typeof v !== 'string' || !v.length)) throw invalidParams(`design.finishes.${role}: expected a key or nonempty list of keys`);
  }
  if (!record(options) || options.materials === undefined) throw invalidParams('options.materials: required');
  exactKeys(options, ['materials', 'outDir', 'mode'], 'options');
  if (options.mode !== undefined && !['glb', 'manifest'].includes(String(options.mode))) throw invalidParams('options.mode: expected glb or manifest');
  if (options.outDir !== undefined && (typeof options.outDir !== 'string' || !options.outDir.length)) throw invalidParams('options.outDir: expected a nonempty directory path');
}
export function buildOptions(options: unknown): BuildOptions { return options as BuildOptions; }
