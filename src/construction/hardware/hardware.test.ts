import { createHash } from 'node:crypto';
import { expect, it } from 'vitest';
import { createHardware } from './index.ts';
import type { FurnitureOptions } from './schema.ts';
import reference from './fixtures/source-hardware.json' with { type: 'json' };

const digest = (values: ArrayBufferView) => createHash('sha256')
  .update(Buffer.from(values.buffer, values.byteOffset, values.byteLength)).digest('hex');

it('retains the original source hardware positions, normals, metre UVs and topology', () => {
  for (const sample of reference.cases) {
    const model = createHardware(sample.options as FurnitureOptions);
    expect(model.parts.map(part => part.material)).toEqual(sample.parts.map(part => part.material));
    for (const [index, part] of model.parts.entries()) {
      const source = sample.parts[index]!;
      for (const name of ['position', 'normal', 'uv'] as const) {
        expect(digest(part.geometry.getAttribute(name).array), `${sample.options.kind}:${sample.options.style}:${part.material}:${name}`)
          .toBe(source.attributes[name]);
      }
      expect(digest(part.geometry.index!.array)).toBe(source.index);
      part.geometry.computeBoundingBox();
      expect([part.geometry.boundingBox!.min.toArray(), part.geometry.boundingBox!.max.toArray()]).toEqual(source.bounds);
    }
    let disposed = 0;
    model.parts.forEach(part => part.geometry.addEventListener('dispose', () => disposed++));
    model.dispose(); model.dispose();
    expect(disposed).toBe(model.parts.length);
  }
});

it('rejects invalid dimensions, styles and unsupported screen-bearing hardware', () => {
  const options: FurnitureOptions = { kind: 'guard', length: 2, depth: 1, style: 0, damaged: false };
  for (const invalid of [{ length: 0 }, { depth: NaN }, { style: 6 }, { damaged: 'yes' }, { kind: 'ramp' },
    { kind: 'marquee', depth: 0.5, length: 0.5 }, { kind: 'marquee', length: 2, depth: 0.7 }, { kind: 'marquee-cap', depth: 0.5, length: 0.4 },
    { kind: 'marquee-cap', depth: 0.5, length: 0.27, style: 2 }]) {
    expect(() => createHardware({ ...options, ...invalid } as FurnitureOptions))
      .toThrowError(expect.objectContaining({ code: 'E_INVALID_PARAMS' }));
  }
  // The run caps, start (style 0) and end (style 1), are the marquee parts shorter than a metre.
  for (const style of [0, 1]) createHardware({ kind: 'marquee-cap', length: 0.27, depth: 0.5, style, damaged: false }).dispose();
});
