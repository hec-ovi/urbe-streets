import { invariant } from '../errors.ts';
import type { NativeMesh } from '../construction/surfaces/schema.ts';
import type { NativePieceData } from './native-schema.ts';

type Vertex = number[];
const size = 128;
function cut(vertices: Vertex[], axis: number, boundary: number, sign: number): Vertex[] {
  const result: Vertex[] = [];
  for (let i = 0; i < vertices.length; i++) {
    const a = vertices[i]!, b = vertices[(i + 1) % vertices.length]!, da = (a[axis]! - boundary) * sign, db = (b[axis]! - boundary) * sign;
    if (da >= 0) result.push(a);
    if ((da < 0 && db > 0) || (da > 0 && db < 0)) {
      const t = da / (da - db), v = a.map((value, index) => value + (b[index]! - value) * t); v[axis] = boundary; v[10] = 1; result.push(v);
    }
  }
  return result;
}
function area(a: Vertex, b: Vertex, c: Vertex): number {
  const x=b[0]!-a[0]!,y=b[1]!-a[1]!,z=b[2]!-a[2]!,u=c[0]!-a[0]!,v=c[1]!-a[1]!,w=c[2]!-a[2]!;
  return Math.hypot(y*w-z*v,z*u-x*w,x*v-y*u)/2;
}

/** Clips whole authored triangles while interpolating every vertex field in its original domain. */
export class NativePartition {
  private readonly cells = new Map<string, { piece: NativePieceData; groups: Map<string, NativeMesh> }>();
  add(source: NativeMesh): void {
    const count=source.positions.length/3;
    if(!Number.isInteger(count/3)||source.normals.length!==count*3||source.uvs.length!==count*2||source.wear.length!==count||source.heights.length!==count)
      throw invariant('Native mesh has incomplete vertex attributes',{meshId:source.id});
    for(let i=0;i<count;i+=3){
      const vertices=Array.from({length:3},(_,k)=>{const j=i+k;return [...source.positions.slice(j*3,j*3+3),...source.normals.slice(j*3,j*3+3),...source.uvs.slice(j*2,j*2+2),source.wear[j]!,source.heights[j]!,0];});
      if(vertices.some(v=>v.some(value=>!Number.isFinite(value))))throw invariant('Native mesh contains nonfinite attributes',{meshId:source.id});
      const expected=area(vertices[0]!,vertices[1]!,vertices[2]!); if(expected===0)throw invariant('Native mesh contains a degenerate triangle',{meshId:source.id});
      const minX=Math.min(...vertices.map(v=>v[0]!)),maxX=Math.max(...vertices.map(v=>v[0]!)),minZ=Math.min(...vertices.map(v=>v[2]!)),maxZ=Math.max(...vertices.map(v=>v[2]!));
      const firstX=Math.floor(minX/size),firstZ=Math.floor(minZ/size),lastX=Math.max(firstX,Math.ceil(maxX/size)-1),lastZ=Math.max(firstZ,Math.ceil(maxZ/size)-1);
      let actual=0;
      for(let x=firstX;x<=lastX;x++)for(let z=firstZ;z<=lastZ;z++){
        let polygon=vertices;
        for(const [axis,boundary,sign] of [[0,x*size,1],[0,(x+1)*size,-1],[2,z*size,1],[2,(z+1)*size,-1]])polygon=cut(polygon,axis!,boundary!,sign!);
        for(let j=1;j<polygon.length-1;j++){
          const triangle=[polygon[0]!,polygon[j]!,polygon[j+1]!], measured=area(...triangle as [Vertex,Vertex,Vertex]); if(measured===0)continue;
          actual+=measured;this.append(x,z,source,triangle);
        }
      }
      if(Math.abs(actual-expected)>Math.max(1e-10,expected*1e-9))throw invariant('Bounded export loses source triangle area',{meshId:source.id,expected,actual});
    }
  }
  finish(): NativePieceData[] { return [...this.cells.values()].map(cell=>cell.piece).sort((a,b)=>a.id.localeCompare(b.id,'en')); }
  private append(x:number,z:number,source:NativeMesh,vertices:Vertex[]):void{
    const id=`sp:${x}:${z}`;let cell=this.cells.get(id);
    if(!cell){cell={piece:{id,origin:[x*size,0,z*size],bounds:{min:[Infinity,Infinity,Infinity],max:[-Infinity,-Infinity,-Infinity]},meshes:[]},groups:new Map()};this.cells.set(id,cell);}
    const key=`${source.surface}:${source.collision}`;let mesh=cell.groups.get(key);
    if(!mesh){mesh={id:`${id}:${key}`,surface:source.surface,collision:source.collision,ownerIds:[],groundIds:[],positions:[],normals:[],uvs:[],wear:[],heights:[]};cell.groups.set(key,mesh);cell.piece.meshes.push(mesh);}
    for(const owner of source.ownerIds)if(!mesh.ownerIds.includes(owner))mesh.ownerIds.push(owner);
    for(const ground of source.groundIds)if(!mesh.groundIds.includes(ground))mesh.groundIds.push(ground);
    for(const v of vertices){
      mesh.positions.push(...v.slice(0,3));
      const normalLength = v[10] ? Math.hypot(v[3]!,v[4]!,v[5]!) : 1;
      if (!normalLength) throw invariant('Clipped vertex has no normal', {meshId:source.id});
      mesh.normals.push(v[3]!/normalLength,v[4]!/normalLength,v[5]!/normalLength);mesh.uvs.push(v[6]!,v[7]!);mesh.wear.push(v[8]!);mesh.heights.push(v[9]!);
      for(let axis=0;axis<3;axis++){(cell.piece.bounds.min as unknown as number[])[axis]=Math.min(cell.piece.bounds.min[axis]!,v[axis]!);(cell.piece.bounds.max as unknown as number[])[axis]=Math.max(cell.piece.bounds.max[axis]!,v[axis]!);}
    }
  }
}
