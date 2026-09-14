import type { Box2, Vec2 } from '../../geometry/schema.ts';
export interface WearOptions { seed: number; bounds: Box2; streets: number; amount: number }
export interface WearZone { center: Vec2; radius: number; strength: number }
export interface WearSnapshot extends WearOptions { version: 'source-zones-1.0.0'; zones: WearZone[] }
export interface PanelRow { depth: number; length: 1 | 2 | 4; width: 0.5 | 1 | 2; band: 'edge' | 'service' | 'field' | 'trim'; finish: 'base' | 'accent' | 'light' | 'dark' | 'metal' }
export interface PanelPalette { base: 'polished' | 'ordinary' | 'worn-a' | 'worn-b' | 'worn-c'; accent: 'oxblood' | 'terracotta'; light: 'aggregate'; dark: 'basalt'; metal: 'treadOchre' | 'tread' }
