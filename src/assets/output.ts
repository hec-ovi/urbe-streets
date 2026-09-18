import { mkdir, writeFile, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { invalidParams } from '../errors.ts';
import type { NativeStreetManifest } from '../schema/native-result.ts';

/** Owns one newly created directory. The manifest is written after all its assets. */
export class Output {
  private readonly directory: string;
  private constructor(directory: string) { this.directory = directory; }
  static async create(directory: string): Promise<Output> {
    try { await mkdir(directory); }
    catch { throw invalidParams('outDir: destination must be new and its parent must exist'); }
    return new Output(directory);
  }
  async asset(path: string, data: Uint8Array): Promise<void> {
    try { await mkdir(dirname(join(this.directory, path)), { recursive: true }); await writeFile(join(this.directory, path), data, { flag: 'wx' }); }
    catch { throw invalidParams('outDir: cannot write model asset'); }
  }
  async finish(manifest: NativeStreetManifest): Promise<void> {
    try { await writeFile(join(this.directory, 'manifest.json'), JSON.stringify(manifest), { flag: 'wx' }); }
    catch { throw invalidParams('outDir: cannot write manifest'); }
  }
  async abort(): Promise<void> {
    try { await rm(this.directory, { recursive: true, force: true }); }
    catch { throw invalidParams('outDir: incomplete output could not be removed'); }
  }
}
