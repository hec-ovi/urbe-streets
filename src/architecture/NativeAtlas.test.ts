import { createHash } from 'node:crypto';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { readNativeAtlas } from './NativeAtlas.ts';
import { nativeBlueprint } from './fixtures/native.ts';

const hash = (value: string) => createHash('sha256').update(value).digest('hex');

it('retains source ownership and distinguishes exact file bytes from object serialization', async () => {
  const source = nativeBlueprint(), text = JSON.stringify(source, null, 2) + '\n';
  const folder = await mkdtemp(join(tmpdir(), 'native-atlas-'));
  try {
    const file = join(folder, 'blueprint.json'); await writeFile(file, text);
    const saved = await readNativeAtlas(file), object = await readNativeAtlas(source);
    expect(saved.identity).toEqual({ hash: hash(text), encoding: 'json-file-bytes' });
    expect(object.identity).toEqual({ hash: hash(JSON.stringify(source)), encoding: 'json-stringify-utf8' });
    expect({ ...saved, identity: object.identity }).toEqual(object);
    expect(saved.owners[0]!.ground[0]).toMatchObject({ id: 'atlas-ground:0', sourceIndex: 0, ownerId: 'roadway', top: 0 });
    expect(saved.roads[0]!.lanes.map(lane => lane.id)).toEqual(['e0.v0', 'e0.v1']);
    source.volumetric.ground[0]!.polygon[0]![0] = 9;
    expect(saved.owners[0]!.ground[0]!.ring[0]).toEqual([0, 0]);
  } finally { await rm(folder, { recursive: true, force: true }); }
});

it('fails closed on missing reservations, conflicting ground ownership and unsupported inputs', async () => {
  const a = nativeBlueprint(); a.streets.construction.reservations.version = 'unknown';
  await expect(readNativeAtlas(a)).rejects.toMatchObject({ code: 'E_UNSUPPORTED_ARCHITECTURE', details: { path: 'streets.construction.reservations.version' } });
  const b = nativeBlueprint(); b.streets.construction.reservations.owners[0]!.groundIndices.push(0);
  await expect(readNativeAtlas(b)).rejects.toMatchObject({ code: 'E_UNSUPPORTED_ARCHITECTURE' });
  await expect(readNativeAtlas({ version: 'archive-index', parts: [] })).rejects.toMatchObject({ code: 'E_UNSUPPORTED_ARCHITECTURE' });
  await expect(readNativeAtlas('/missing/blueprint.json')).rejects.toMatchObject({ code: 'E_INVALID_PARAMS' });
});
