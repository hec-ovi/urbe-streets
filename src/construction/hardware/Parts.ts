import { BoxGeometry, CylinderGeometry, Quaternion, Vector3, type BufferGeometry } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { FurniturePart, FurnitureMaterials } from './schema.ts';

export class Parts {
  private readonly pieces = new Map<keyof FurnitureMaterials, BufferGeometry[]>();
  add(material: keyof FurnitureMaterials, geometry: BufferGeometry): void {
    const list = this.pieces.get(material) ?? [];
    list.push(geometry); this.pieces.set(material, list);
  }
  box(material: keyof FurnitureMaterials, w: number, h: number, d: number, x = 0, y = 0, z = 0): void {
    const geometry = new BoxGeometry(w, h, d).translate(x, y, z);
    const position = geometry.getAttribute('position'), normal = geometry.getAttribute('normal'), uv = geometry.getAttribute('uv');
    for (let i = 0; i < position.count; i++) {
      if (Math.abs(normal.getY(i)) > 0.5) uv.setXY(i, position.getX(i), position.getZ(i));
      else if (Math.abs(normal.getZ(i)) > 0.5) uv.setXY(i, position.getX(i), position.getY(i));
      else uv.setXY(i, position.getZ(i), position.getY(i));
    }
    this.add(material, geometry);
  }
  beam(material: keyof FurnitureMaterials, a: number[], b: number[], radius: number): void {
    const start = new Vector3(...a), end = new Vector3(...b), delta = end.clone().sub(start);
    const geometry = new CylinderGeometry(radius, radius, delta.length(), 6);
    geometry.applyQuaternion(new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), delta.normalize()));
    geometry.translate(...start.add(end).multiplyScalar(0.5).toArray());
    this.add(material, geometry);
  }
  finish(): FurniturePart[] {
    return [...this.pieces].map(([material, geometries]) => {
      const geometry = mergeGeometries(geometries)!;
      geometries.forEach(g => g.dispose());
      return { material, geometry };
    });
  }
}
