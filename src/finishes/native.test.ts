import {createHash} from 'node:crypto';
import {expect,it} from 'vitest';
import {NativeCatalog} from './NativeCatalog.ts';
const input=()=>({version:1,source:{project:'threejsscene',revision:'ac7c2fc02095b47d0a8fd7fda535e4ea7ce6452e',manifest:'sources/streets/scene-native/manifest.json'},sampling:{asphalt:{}},
  textures:{scan:{path:'themes/cyberpunk/assets/street-native/scan.png',sha256:'a'.repeat(64),resolution:[4,4],colorSpace:'linear',wrap:['repeat','repeat']}},
  surfaces:{joint:{effect:'solid',maps:{},uv:{mode:'metres'},parameters:{tint:'#202020',roughness:1,metalness:0}}}});
it('owns the exact ordered snapshot and rejects unavailable or unsafe references',async()=>{
  const source=input(),catalog=await NativeCatalog.load(source);
  expect(catalog.hash).toBe(createHash('sha256').update(JSON.stringify(source)).digest('hex'));
  source.surfaces.joint.parameters.roughness=0;expect(catalog.binding.surfaces.joint!.parameters.roughness).toBe(1);
  expect(()=>catalog.require('missing')).toThrowError(expect.objectContaining({code:'E_INVALID_PARAMS'}));
  const unsafe=input();unsafe.textures.scan.path='../scan.png';await expect(NativeCatalog.load(unsafe)).rejects.toMatchObject({code:'E_INVALID_PARAMS'});
  await expect(NativeCatalog.load({version:2})).rejects.toMatchObject({code:'E_INVALID_PARAMS'});
});
