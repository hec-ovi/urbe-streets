import { invariant } from '../../errors.ts';
import type { NativeCorner, NativeOwner } from '../../architecture/native-schema.ts';
import type { Vec2 } from '../../geometry/schema.ts';
import { add, dot, distance, scale } from './Frame.ts';
export interface CornerCut { corner: NativeCorner & { kind: 'arc' }; at: Vec2; hub: Vec2; feet: [Vec2, Vec2] }

/** Original square cuts and shared face allowance, using the producer's tangent lines. */
export function cornerCuts(owner: NativeOwner): CornerCut[] {
  const fronts = new Map(owner.frontages.map(frontage => [frontage.id, frontage]));
  const frames = owner.corners.filter((corner): corner is NativeCorner & { kind: 'arc' } => corner.kind === 'arc').map(corner => {
    const into = fronts.get(corner.frontageIds[0]!), out = fronts.get(corner.frontageIds[1]!);
    if (!into || !out) throw invariant('Corner has no authored straight faces', { cornerId: corner.id });
    const a = into.inward, b = out.inward, determinant = a[0] * b[1] - a[1] * b[0];
    if (Math.abs(determinant) < 1e-9) throw invariant('Corner tangent supports are parallel', { cornerId: corner.id });
    const da = dot(a, into.end), db = dot(b, out.start);
    const at: Vec2 = [(da * b[1] - a[1] * db) / determinant, (a[0] * db - da * b[0]) / determinant];
    const u: Vec2 = [-into.inward[1], into.inward[0]], w: Vec2 = [out.inward[1], -out.inward[0]], c = dot(u, w);
    const half = Math.acos(Math.max(-1, Math.min(1, c))) / 2, tangent = distance(at, corner.arc[0]!);
    const behind = (Math.max(into.pavedWidth, out.pavedWidth) + 2.5) / Math.tan(half);
    return { corner, at, u, w, c, tangent, want: Math.max(0, behind - tangent) };
  });
  const share = new Map<string, number>();
  for (const { corner, want } of frames) for (const face of corner.frontageIds) share.set(face, (share.get(face) ?? 0) + want);
  for (const [id, wanted] of share) share.set(id, wanted ? Math.min(1, Math.max(0, fronts.get(id)!.length - 1) / wanted) : 1);
  return frames.map(({ corner, at, u, w, c, tangent, want }) => {
    const spans = corner.frontageIds.map(face => tangent + want * share.get(face)!);
    const alpha = (spans[0]! - c * spans[1]!) / (1 - c * c), beta = (spans[1]! - c * spans[0]!) / (1 - c * c);
    return { corner, at, hub: add(at, add(scale(u, alpha), scale(w, beta))), feet: [add(at, scale(u, spans[0]!)), add(at, scale(w, spans[1]!))] };
  });
}
