import type { Vec3 } from '../geometry/schema.ts';

type Attribute = Float32Array | Int8Array | Uint8Array | Int16Array | Uint16Array;
export interface QuantizedPositions { array: Float32Array | Int16Array; offset: Vec3; scale: number }

/** A uniform decode scale preserves normal directions and standard glTF transforms. */
export function quantizePositions(source: Float32Array): QuantizedPositions {
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < source.length; i++) {
    const axis = i % 3;
    min[axis] = Math.min(min[axis]!, source[i]!);
    max[axis] = Math.max(max[axis]!, source[i]!);
  }
  const offset = min.map((value, axis) => (value + max[axis]!) / 2) as unknown as Vec3;
  const scale = Math.max(...min.map((value, axis) => (max[axis]! - value) / 2));
  const fallback = { array: source, offset: [0, 0, 0] as Vec3, scale: 1 };
  if (!scale || !Number.isFinite(scale)) return fallback;
  const array = new Int16Array(source.length);
  for (let i = 0; i < source.length; i += 3) {
    let squaredError = 0;
    for (let axis = 0; axis < 3; axis++) {
      const value = source[i + axis]!;
      const encoded = Math.round((value - offset[axis]!) / scale * 32767);
      array[i + axis] = encoded;
      const decoded = encoded / 32767 * scale + offset[axis]!;
      squaredError += (decoded - value) ** 2;
    }
    if (squaredError > 0.001 ** 2) return fallback;
  }
  return { array, offset, scale };
}

/** Normalized storage keeps the original semantic values, without custom decode settings. */
export function quantizeNormalized(source: Float32Array, tolerance: number, bits?: 16): Attribute {
  const candidates = bits === 16 ? [Uint16Array] : [Uint8Array, Int8Array, Uint16Array, Int16Array];
  for (const Type of candidates) {
    const signed = Type === Int8Array || Type === Int16Array;
    const limit = 2 ** (Type.BYTES_PER_ELEMENT * 8 - Number(signed)) - 1;
    const array = new Type(source.length);
    let fits = true;
    for (let i = 0; i < source.length; i++) {
      const value = source[i]!;
      if (value < (signed ? -1 : 0) || value > 1) { fits = false; break; }
      const encoded = Math.round(value * limit);
      if (Math.abs(Math.fround(encoded / limit) - value) > tolerance) { fits = false; break; }
      array[i] = encoded;
    }
    if (fits) return array;
  }
  return source;
}

export function quantizeNormals(source: Float32Array): Float32Array | Int16Array {
  if (source.some(value => value < -1 || value > 1)) return source;
  return Int16Array.from(source, value => Math.round(value * 32767));
}
