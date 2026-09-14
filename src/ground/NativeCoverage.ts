import {invariant,unsatisfiable} from '../errors.ts';
import type {NativeArchitecture,NativeOwner} from '../architecture/native-schema.ts';
import type {CoverageClaim} from '../construction/surfaces/schema.ts';
import type {NativeStreetManifest} from '../schema/native-result.ts';
import {difference,intersection,totalArea,union} from '../geometry/polygons.ts';

/** Each receiving owner proves coverage independently, so neighboring owners cannot hide a loss. */
export class NativeCoverage {
  private readonly architecture:NativeArchitecture;
  private readonly seen=new Set<string>();
  private readonly cover={reservedArea:0,excludedArea:0,constructedArea:0,missingArea:0,outsideArea:0};
  constructor(architecture:NativeArchitecture){this.architecture=architecture;}
  add(owner:NativeOwner,claims:CoverageClaim[]):void{
    if(this.seen.has(owner.id)||claims.some(claim=>claim.ownerId!==owner.id))throw invariant('Coverage has conflicting owner identity',{ownerId:owner.id});
    const reserved=union(owner.ground.map(ground=>ground.ring)),expected=difference(reserved,this.architecture.shafts.map(shaft=>shaft.ring));
    const actual=union(claims.flatMap(claim=>claim.rings)),missing=totalArea(difference(expected,actual)),outside=totalArea(difference(actual,expected));
    if(missing>1e-7||outside>1e-7)throw invariant('Native construction does not cover its reserved receiving fields',{ownerId:owner.id,missing,outside});
    const encroachment=totalArea(intersection(actual,this.architecture.exclusions));
    if(encroachment>1e-7)throw unsatisfiable('Native construction enters parcel or water exclusion',{ownerId:owner.id,area:encroachment});
    this.seen.add(owner.id);this.cover.reservedArea+=totalArea(reserved);this.cover.excludedArea+=totalArea(reserved)-totalArea(expected);
    this.cover.constructedArea+=totalArea(actual);this.cover.missingArea+=missing;this.cover.outsideArea+=outside;
  }
  finish():NativeStreetManifest['ground']{
    if(this.architecture.owners.some(owner=>!this.seen.has(owner.id)))throw invariant('Native construction omits a reserved ground owner');
    const owners=this.architecture.owners.flatMap(owner=>owner.ground.map(ground=>({id:ground.id,sourceIndex:ground.sourceIndex,ownerId:owner.id,role:ground.surface,polygon:ground.ring,bottom:ground.bottom,top:ground.top})));
    return {owners,replacements:{groundIndices:owners.map(owner=>owner.sourceIndex).sort((a,b)=>a-b),moduleOwnerIds:this.architecture.owners.map(owner=>owner.id)},
      exclusions:this.architecture.shafts.map(shaft=>({id:shaft.id,kind:'station-shaft',stationId:shaft.stationId,polygon:shaft.ring})),cover:{...this.cover}};
  }
}
