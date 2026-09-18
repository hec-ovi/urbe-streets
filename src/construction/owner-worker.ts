import { parentPort } from 'node:worker_threads';
import { StreetsError } from '../errors.ts';
import { OwnerConstruction } from './OwnerConstruction.ts';
import type { OwnerMessage, OwnerResult } from './OwnerWorkers.ts';

const port = parentPort!;
let construction: OwnerConstruction | undefined;

/** Doubles survive as Float64Array, so a worker owner is bit-identical to a local one. */
function transfer(result: ReturnType<OwnerConstruction['build']>): { value: OwnerResult; buffers: ArrayBuffer[] } {
  const buffers: ArrayBuffer[] = [];
  const meshes = result.meshes.map(mesh => {
    const fields = (['positions', 'normals', 'uvs', 'wear', 'heights'] as const).map(field => Float64Array.from(mesh[field] as number[]));
    for (const field of fields) buffers.push(field.buffer as ArrayBuffer);
    return { id: mesh.id, surface: mesh.surface, collision: mesh.collision, ownerIds: mesh.ownerIds, groundIds: mesh.groundIds,
      positions: fields[0]!, normals: fields[1]!, uvs: fields[2]!, wear: fields[3]!, heights: fields[4]! };
  });
  return { value: { meshes, coverage: result.coverage, panels: result.panels }, buffers };
}

port.on('message', (message: OwnerMessage) => {
  try {
    if (message.kind === 'open') { construction = new OwnerConstruction(message.architecture, message.seed, message.amount); port.postMessage({ kind: 'ready' }); return; }
    const { value, buffers } = transfer(construction!.build(message.index));
    port.postMessage({ kind: 'done', id: message.id, result: value }, buffers);
  } catch (error) {
    const failure = error instanceof StreetsError ? { code: error.code, message: error.message, details: error.details }
      : { code: 'E_INVARIANT' as const, message: error instanceof Error ? error.message : String(error), details: undefined };
    port.postMessage({ kind: 'failed', id: message.kind === 'build' ? message.id : -1, ...failure });
  }
});
