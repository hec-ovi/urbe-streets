import { invalidParams } from '../../errors.ts';
import definitions from './panel-rows.json' with { type: 'json' };
import { random } from './random.ts';
import type { PanelPalette, PanelRow } from './schema.ts';
const profiles = definitions as Omit<PanelRow, 'depth'>[][];

export class PanelStyle {
  static rows(width: number, seed: number, key: string): PanelRow[] {
    if (![2, 4, 6].includes(width) || !Number.isSafeInteger(seed) || !key) throw invalidParams('Invalid native panel row input');
    const profile = profiles[Math.floor(random(seed, `${key}:rows`) * profiles.length)]!;
    const rows: PanelRow[] = [];
    let depth = 0.5;
    for (let i = 0; depth < width + 0.5; i++) {
      const row = profile[i % profile.length]!, remaining = width + 0.5 - depth;
      const span = remaining >= row.width ? row.width : remaining >= 1 ? 1 : 0.5;
      rows.push({ ...row, depth, width: span, length: span === 0.5 ? 1 : row.length }); depth += span;
    }
    return rows;
  }
  static palette(seed: number, ownerId: string, wear: number): PanelPalette {
    if (!Number.isSafeInteger(seed) || !ownerId || !Number.isFinite(wear) || wear < 0 || wear > 1) throw invalidParams('Invalid native panel palette input');
    const coated = random(seed, `${ownerId}:style`) < 0.35, r = random(seed, `${ownerId}:palette`);
    return { base: coated ? 'polished' : r < wear * 0.65 ? (['worn-a', 'worn-b', 'worn-c'] as const)[Math.floor(r * 913) % 3]! : 'ordinary',
      accent: r < 0.75 ? 'oxblood' : 'terracotta', light: 'aggregate', dark: 'basalt', metal: r < 0.35 ? 'treadOchre' : 'tread' };
  }
}
