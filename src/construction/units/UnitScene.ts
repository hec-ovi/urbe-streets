import type { NativeArchitecture, NativeOwner } from '../../architecture/native-schema.ts';
import type { Ring } from '../../geometry/schema.ts';

export interface SceneInput {
  architecture: NativeArchitecture;
  edgeOwners: NativeOwner[];
  variant: string;
  seam?: Ring;
  paint?: boolean;
}
