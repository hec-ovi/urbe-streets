import { afterEach, expect, it, vi } from 'vitest';
import { availableParallelism } from 'node:os';
import { width } from './OwnerWorkers.ts';

vi.mock('node:os', () => ({ availableParallelism: vi.fn() }));
afterEach(() => vi.unstubAllEnvs());

it('defaults to a quarter of available parallelism, floors, bounds by owners and honours overrides', () => {
  vi.stubEnv('STREETS_WORKERS', undefined);
  for (const [cores, owners, expected] of [[1, 20, 1], [3, 20, 1], [7, 20, 1], [8, 20, 2], [19, 20, 4], [32, 3, 3], [32, 0, 0]]) {
    vi.mocked(availableParallelism).mockReturnValue(cores!);
    expect(width(owners!)).toBe(expected);
  }
  for (const requested of ['0', '1', '4']) { vi.stubEnv('STREETS_WORKERS', requested); expect(width(2)).toBe(Number(requested)); }
  for (const requested of ['-1', '1.5', 'many']) {
    vi.stubEnv('STREETS_WORKERS', requested);
    expect(() => width(2)).toThrowError(expect.objectContaining({ code: 'E_INVALID_PARAMS' }));
  }
});
