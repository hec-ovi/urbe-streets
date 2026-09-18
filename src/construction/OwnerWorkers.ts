import { Worker } from 'node:worker_threads';
import { availableParallelism } from 'node:os';
import { StreetsError, invalidParams } from '../errors.ts';
import type { NativeArchitecture } from '../architecture/native-schema.ts';
import type { CoverageClaim, NativeMeshData } from './surfaces/schema.ts';

export interface OwnerResult { meshes: NativeMeshData[]; coverage: CoverageClaim[]; panels: number }
export type OwnerMessage =
  | { kind: 'open'; architecture: NativeArchitecture; seed: number; amount: number }
  | { kind: 'build'; id: number; index: number };
type Reply = { kind: 'ready' } | { kind: 'done'; id: number; result: OwnerResult }
  | { kind: 'failed'; id: number; code: StreetsError['code']; message: string; details?: Record<string, unknown> };
interface Job { id: number; index: number; resolve: (result: OwnerResult) => void; reject: (error: Error) => void }

/**
 * Every owner is an independent job, so the default width is the machine's parallelism minus the thread
 * that assembles the city, and never more workers than owners. STREETS_WORKERS overrides it exactly; 0 or 1 builds here.
 */
export function width(owners: number): number {
  const override = process.env.STREETS_WORKERS;
  if (override === undefined) return Math.min(Math.max(availableParallelism() - 1, 1), owners);
  const requested = Number(override);
  if (!Number.isInteger(requested) || requested < 0) throw invalidParams('STREETS_WORKERS must be a non-negative integer');
  return requested;
}

export class OwnerWorkers {
  private readonly slots: { worker: Worker; job: Job | null }[] = [];
  private readonly queue: Job[] = [];
  private sequence = 0;
  private closed = false;

  /** Resolves once every worker holds the same architecture, so jobs never wait on startup twice. */
  static async open(architecture: NativeArchitecture, seed: number, amount: number, size: number): Promise<OwnerWorkers> {
    const pool = new OwnerWorkers();
    await Promise.all(Array.from({ length: size }, () => new Promise<void>((resolve, reject) => {
      const slot: { worker: Worker; job: Job | null } = { worker: new Worker(new URL('./owner-worker.ts', import.meta.url)), job: null };
      pool.slots.push(slot);
      slot.worker.on('message', (reply: Reply) => { if (reply.kind === 'ready') resolve(); else pool.complete(slot, reply); });
      slot.worker.on('error', error => { reject(error); pool.fail(error); });
      slot.worker.on('exit', code => { if (!pool.closed) pool.fail(new Error(`Street owner worker exited (${code})`)); });
      slot.worker.postMessage({ kind: 'open', architecture, seed, amount } satisfies OwnerMessage);
    }))).catch(async error => { await pool.close(); throw error; });
    return pool;
  }

  build(index: number): Promise<OwnerResult> {
    return new Promise((resolve, reject) => { this.queue.push({ id: this.sequence++, index, resolve, reject }); this.dispatch(); });
  }

  async close(): Promise<void> {
    this.closed = true;
    this.abort(new StreetsError('E_INVARIANT', 'Street owner workers closed before completion'));
    await Promise.all(this.slots.map(slot => slot.worker.terminate()));
  }

  private dispatch(): void {
    for (const slot of this.slots) {
      if (slot.job || !this.queue.length) continue;
      slot.job = this.queue.shift()!;
      slot.worker.postMessage({ kind: 'build', id: slot.job.id, index: slot.job.index } satisfies OwnerMessage);
    }
  }

  private complete(slot: { worker: Worker; job: Job | null }, reply: Reply): void {
    const job = slot.job;
    if (reply.kind === 'ready' || !job || reply.id !== job.id) { this.fail(new Error('Street owner worker replied out of order')); return; }
    slot.job = null;
    if (reply.kind === 'failed') job.reject(new StreetsError(reply.code, reply.message, reply.details));
    else job.resolve(reply.result);
    if (!this.closed) this.dispatch();
  }

  private abort(error: Error): void {
    for (const job of this.queue.splice(0)) job.reject(error);
    for (const slot of this.slots) { slot.job?.reject(error); slot.job = null; }
  }

  private fail(error: Error): void {
    if (this.closed) return;
    this.abort(error instanceof StreetsError ? error : new StreetsError('E_INVARIANT', error.message));
    void this.close();
  }
}
