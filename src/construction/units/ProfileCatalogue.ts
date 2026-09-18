import data from './profiles.json' with { type: 'json' };
import type { NativeRoad } from '../../architecture/native-schema.ts';
import type { StreetProfile, StreetProfileMapping } from '../../schema/street-kit.ts';

/** Atlas district modules, with stable catalogue order breaking equal distance ties. */
export class ProfileCatalogue {
  readonly profiles = data.map(profile => ({ ...profile })) as StreetProfile[];
  readonly mappings: StreetProfileMapping[] = [];
  private readonly selected = new Map<string, StreetProfile>();

  select(road: NativeRoad): StreetProfile {
    const previous = this.selected.get(road.id);
    if (previous) return previous;
    const choices = this.profiles.filter(p => p.streetClass === road.kind && p.zone === (road.districtStyle ?? 'ordinary'));
    const profile = choices.reduce((a, b) => Math.abs(b.width - road.width) < Math.abs(a.width - road.width) ? b : a);
    this.selected.set(road.id, profile);
    if (Math.abs(profile.width - road.width) > 1e-7) this.mappings.push({ roadId: road.id, profileId: profile.id,
      requestedWidth: road.width, width: profile.width, delta: Math.round((profile.width - road.width) * 1e8) / 1e8 });
    return profile;
  }
}
