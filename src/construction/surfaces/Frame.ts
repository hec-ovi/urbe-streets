import type { Vec2 } from '../../geometry/schema.ts';
import type { NativeFrontage } from '../../architecture/native-schema.ts';
export const add = (a: Vec2, b: Vec2): Vec2 => [a[0] + b[0], a[1] + b[1]];
export const sub = (a: Vec2, b: Vec2): Vec2 => [a[0] - b[0], a[1] - b[1]];
export const scale = (a: Vec2, n: number): Vec2 => [a[0] * n, a[1] * n];
export const dot = (a: Vec2, b: Vec2): number => a[0] * b[0] + a[1] * b[1];
export const cross = (a: Vec2, b: Vec2): number => a[0] * b[1] - a[1] * b[0];
export const distance = (a: Vec2, b: Vec2): number => Math.hypot(a[0] - b[0], a[1] - b[1]);
export const direction = (a: Vec2, b: Vec2): Vec2 => scale(sub(b, a), 1 / distance(a, b));
export const along = (f: Pick<NativeFrontage, 'start' | 'inward'>, station: number, depth = 0): Vec2 =>
  [f.start[0] + f.inward[1] * station + f.inward[0] * depth, f.start[1] - f.inward[0] * station + f.inward[1] * depth];
