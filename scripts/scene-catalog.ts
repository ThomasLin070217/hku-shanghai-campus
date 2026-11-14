import {mkdirSync,writeFileSync} from 'node:fs';
import {buildSite} from '../src/model/buildSite';
import {sceneRegistry} from '../src/scene/registry';
import {disposeAsset} from '../src/model/buildCampus';
const asset=buildSite(),r=sceneRegistry(asset.root),[command,value]=process.argv.slice(2);
if(command==='entity'){const e=r.get(value);if(!e){console.error('Unknown entity: '+value);process.exitCode=1;}else console.log(JSON.stringify(e,null,2));}
else if(command==='find')console.log(JSON.stringify(r.query({q:value??'',limit:100}),null,2));
else{mkdirSync('assets/scene',{recursive:true});writeFileSync('assets/scene/catalog.json',JSON.stringify(r.json(),null,2));writeFileSync('assets/scene/major-index.md','# 校园编号索引\n\n完整细部见 catalog.json；源码编辑后运行 npm run scene:catalog 更新。\n\n| 编号 | 名称 | 源码 |\n|---|---|---|\n'+r.entities.filter(e=>['building','road','area'].includes(e.kind)).map(e=>`| ${e.id} | ${e.name} | ${e.sourceFile} |`).join('\n')+'\n');console.log(`Exported ${r.entities.length} entities; revision ${r.revision}`);}
disposeAsset(asset.root);
