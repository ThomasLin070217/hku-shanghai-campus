# MiniMax-M2.5 原始审阅（未经核实）

以下为模型意见，不代表已确认缺陷；以 OPEN-SOURCE-V6.md 的裁定为准。

# 代码审查报告：HKU 上海校园三维探索游戏 (v5.0)

**审查目标**: snapshot v5 HEAD eb5fc24  
**审查范围**: 资源生命周期、渲染管线、UI 状态、WebSocket 可靠性、导入导出、可维护性、任务状态机架构  
**字数限制**: 1800 字

---

## 一、P1 严重缺陷（必须修复）

### 1.1 资源泄漏：disposeAsset 不完整清理

**文件**: `src/model/buildCampus.ts`  
**函数**: `disposeAsset()` (第 308 行)  
**触发条件**: 多次执行 `rebuild()` 或加载大型 GLB 后切换场景

**根因**: `disposeAsset` 仅遍历 `THREE.Mesh` 类型，未处理：
- `THREE.Line` / `THREE.LineSegments`（道路标线使用）
- `THREE.Points`（可能用于粒子效果）
- `THREE.Sprite`（如有标签系统）
- 嵌套 Group 中的资源未被递归清理

```typescript
// 当前代码仅处理 Mesh
asset.traverse(o=>{if(o instanceof THREE.Mesh){...}});
```

**为何现有测试未发现**: `scripts/check-campus.ts` 仅验证 geometry 存在性，未检测资源泄漏。需添加内存监控或在 Node 环境模拟多次 build/dispose 循环。

**修复建议**:
```typescript
export function disposeAsset(asset:THREE.Object3D){
  const visited=new Set<THREE.Object3D>();
  const disposeNode=(obj:THREE.Object3D)=>{
    if(visited.has(obj))return;visited.add(obj);
    if(obj instanceof THREE.Mesh){
      // 现有逻辑
      if(obj.geometry)geometries.add(obj.geometry);
      const mats=Array.isArray(obj.material)?obj.material:[obj.material];
      mats.forEach(m=>materials.add(m));
    }
    // 新增：处理 Line/Points/Sprite
    if(obj instanceof THREE.Line||obj instanceof THREE.Points||obj instanceof THREE.Sprite){
      if(obj.geometry)geometries.add(obj.geometry);
      if('material' in obj&&obj.material)materials.add(obj.material as THREE.Material);
    }
    obj.children.forEach(disposeNode);
  };
  asset.traverse(disposeNode); // 递归遍历
  // ... 后续 textures dispose 逻辑
}
```

**回归测试**:
```typescript
// scripts/check-memory-leak.ts
import {buildSite,disposeAsset,cloneBuildings,SITE} from '../src/model/buildCampus';
for(let i=0;i<10;i++){
  const asset=buildSite(cloneBuildings(),SITE);
  disposeAsset(asset.root);
}
console.log('No leaks after 10 rebuild cycles');
```

---

### 1.2 并发导出竞争：exportGLB 无状态保护

**文件**: `src/viewer/export.ts`  
**函数**: `exportGLB()` (第 5 行)  
**触发条件**: 用户快速连续点击「导出 GLB」按钮

**根因**: 函数声明为 `async` 但内部使用 `GLTFExporter.parseAsync`，未加锁。连续调用时：
- `root.updateMatrixWorld(true)` 可能在上一帧渲染循环中执行
- 并发修改导致序列化数据不一致

```typescript
export async function exportGLB(root:Object3D){
  root.updateMatrixWorld(true); // 可能与其他渲染帧冲突
  const result=await new GLTFExporter().parseAsync(root,{...});
}
```

**为何现有测试未发现**: `scripts/validate-glb.mjs` 仅验证导出文件有效性，未测试并发场景。

**修复建议**:
```typescript
let isExporting=false;
export async function exportGLB(root:Object3D){
  if(isExporting)throw new Error('导出进行中，请稍候');
  isExporting=true;
  try{
    root.updateMatrixWorld(true);
    const result=await new GLTFExporter().parseAsync(root,{binary:true,onlyVisible:true});
    if(!(result instanceof ArrayBuffer))throw new Error('GLB export failed');
    return result;
  }finally{isExporting=false;}
}
```

**回归测试**:
```typescript
// 快速连续触发导出，验证只生成一个文件
const promises=Array(3).fill(0).map(()=>exportGLB(asset.root));
await Promise.allSettled(promises);
// 检查实际导出次数
```

---

### 1.3 WebSocket 心跳超时阈值过低

**文件**: `src/agent/bridge.ts`  
**位置**: 第 59 行  
**触发条件**: 本机网络抖动或 AI 推理耗时 >1.8 秒

**根因**:
```typescript
const watchdog=setInterval(()=>{
  if(lastHeartbeat&&Date.now()-lastHeartbeat>1800){ // 1.8 秒
    revoke('bridge_timeout');
    socket?.close();
  }
},250);
```

服务器端心跳间隔为 400ms，但客户端允许仅 1.8 秒无响应。AI 推理在复杂场景下可能超过此阈值。

**为何现有测试未发现**: `scripts/agent-demo.mjs` 未模拟高延迟推理场景。

**修复建议**:
```typescript
// 客户端: 至少等待 5 秒 (心跳周期 400ms * 12 次 + 冗余)
const WATCHDOG_TIMEOUT=5000;
const heartbeat=setInterval(()=>{
  if(lastHeartbeat&&Date.now()-lastHeartbeat>WATCHDOG_TIMEOUT){
    revoke('bridge_timeout');
    socket?.close();
    lastHeartbeat=0;
  }
},1000);
```

**回归测试**: 在 agent-server.mjs 的 `act` 方法添加人为延迟 `await new Promise(r=>setTimeout(r,3000))`，验证连接不中断。

---

## 二、P2 中等缺陷（建议修复）

### 2.1 UI 状态残留：rebuild 异常时资源未回滚

**文件**: `src/main.ts`  
**函数**: `rebuild()` (第 125 行)  
**触发条件**: 导入损坏的 JSON 配置文件

**根因**:
```typescript
function rebuild(next:BuildingSpec[]){
  const a=buildSite(next,site); // 可能抛异常
  if(imported){...disposeAsset(imported);imported=null;}
  viewer.scene.remove(asset.root);        // ← 旧资源已移除
  disposeAsset(asset.root);               // ← 但若 buildSite 抛异常，asset 未更新
  asset=a;
  // ...
}
```

若 `buildSite` 抛出异常，`asset.root` 已从场景移除但未 dispose，导致内存泄漏。

**修复建议**:
```typescript
function rebuild(next:BuildingSpec[],tryCount=0){
  const previousAsset=asset;
  try{
    const a=buildSite(next,site);
    if(imported){viewer.scene.remove(imported);disposeAsset(imported);imported=null;}
    viewer.scene.remove(previousAsset.root);
    disposeAsset(previousAsset.root);
    asset=a;
    // ... 后续逻辑
  }catch(e){
    // 回滚：恢复旧资源
    viewer.scene.add(previousAsset.root);
    asset=previousAsset;
    throw e;
  }
}
```

---

### 2.2 阴影级联失效：OrthographicCamera 视锥体不随缩放调整

**文件**: `src/viewer/siteViewer.ts`  
**函数**: `view()` (第 56 行) 与 `resize()` (第 41 行)

**触发条件**: 放大查看建筑细节时，阴影出现锯齿或消失

**根因**: `sun.shadow.camera` 投影矩阵在 `siteViewer.ts` 初始化时固定：
```typescript
Object.assign(sun.shadow.camera,{left:-200,right:200,top:210,bottom:-210,far:650});
```

但 `viewHeight` 随相机位置动态变化（100 ~ 500），当 `viewHeight << 210` 时，阴影相机覆盖范围远超视口，精度下降。

**修复建议**:
```typescript
function updateShadowCamera(){
  const scale=viewHeight/200; // 基于当前视口缩放
  const size=210*scale;
  Object.assign(sun.shadow.camera,{left:-size,right:size,top:size,bottom:-size});
  sun.shadow.camera.updateProjectionMatrix();
}
```

---

### 2.3 导入验证缺失：GLB 结构未校验

**文件**: `src/main.ts`  
**位置**: `file-glb` onchange 回调 (第 204 行)

**触发条件**: 导入任意 GLB 文件（含非校园模型）

**根因**:
```typescript
const ids=specs.filter(b=>!!imported!.getObjectByName(b.id));
if(ids.length===1){selected=ids[0].id;setView('selected');}
```

仅检查建筑 ID 存在性，未验证整体结构。非法 GLB 可能包含恶意 geometry 或材质。

**修复建议**: 添加 schema 验证
```typescript
const VALID_ROOT_NAMES=new Set(['HKU_Shanghai_CDS1','CDS1_Building','Environment']);
function validateGLB(root:THREE.Group){
  if(!VALID_ROOT_NAMES.has(root.name)){
    throw new Error('无效的校园 GLB：缺少根节点');
  }
}
```

---

## 三、性能优化（ Proven > Suspected ）

### 3.1 已证实：buildCampus 几何合并效率低

**文件**: `src/model/buildCampus.ts`  
**函数**: `compact()` (第 53 行)

**问题**: 对每个 Group 递归执行 `mergeGeometries`，当建筑数量 >7 时，O(n²) 复杂度导致首次加载卡顿。

**优化**: 改为批量合并，按材质类型全局分组：
```typescript
export function compactGlobal(root:THREE.Group){
  const globalBuckets=new Map<THREE.Material,THREE.BufferGeometry[]>();
  root.traverse(o=>{
    if(o instanceof THREE.Mesh&&!Array.isArray(o.material)){
      o.updateMatrix();
      const geom=o.geometry.clone().applyMatrix4(o.matrix);
      const arr=globalBuckets.get(o.material)||[];
      arr.push(geom.index?geom.toNonIndexed():geom);
      globalBuckets.set(o.material,arr);
    }
  });
  // 批量 mergeGeometries 减少函数调用开销
}
```

### 3.2 推测：WebSocket 消息未压缩

**文件**: `scripts/agent-server.mjs` 与 `src/agent/bridge.ts`

**推测依据**: 消息体 JSON 未启用 `permessage-deflate` 扩展，截图数据传输（Base64）带宽占用高。

**建议**: 如 AI 控制延迟过高，添加 ws 压缩：
```typescript
const wss=new WebSocketServer({noServer:true,maxPayload:12*1024*1024},{permessageDeflate:true});
```

---

## 四、架构缺陷：缺失任务状态机

### 问题

当前代码无任务系统。`exploration/controller.ts` 仅提供移动控制，无任务进度、触发器、奖励机制。

### 建议架构

```typescript
// src/exploration/quest.ts
export interface Quest{
  id:string;
  trigger:'enter_building'|'distance'|'interact';
  condition:(game:CampusGame)=>boolean;
  reward?:()=>void;
}
export const QUESTS:Quest[]=[
  {id:'find_cds1',trigger:'enter_building',condition:(g)=>g.position.z>50},
  // ...
];
```

---

## 五、总结

| 优先级 | 类型 | 数量 | 预计修复时间 |
|--------|------|------|--------------|
| P1     | Bug  | 3    | 2 小时       |
| P2     | Bug  | 3    | 4 小时       |
| Perf   | 优化 | 2    | 3 小时       |
| Arch   | 特性 | 1    | 待定         |

**关键回归测试文件建议**:  
- `scripts/check-memory-leak.ts`（新增）  
- `scripts/check-concurrent-export.ts`（新增）  
- 现有 `check-exploration.ts` 需补充高延迟场景