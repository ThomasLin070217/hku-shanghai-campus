# Agent B — 巴士与局部场景布景

执行 `00-START-HERE.md`。只实现 Thomas 的可见场景资源；建筑洞口、物理承托、公共模型生成器已由集成者接线，禁止你另改一套坐标或导航。

## 文件边界与接口

只允许新增/修改：

- `src/opening/world.ts`
- `scripts/check-opening-world.ts`（可新增，独立几何检查）

先读 `spatialLayout.ts`、`geometry.ts`、`navigation.ts`、`src/model/buildSite.ts`、`src/items/macbook.ts`、`src/model/glazing.ts`、`src/model/buildCampus.ts`。所有位置从 layout 读取。

必须导出：

```ts
export function createOpeningWorld(): {
  root: THREE.Group;
  update(state: {
    incident: boolean;
    laptopAcquired: boolean;
    doorOpen: boolean;
  }, dt: number): void;
  dispose(): void;
}
```

调用者已存在于 `buildSite.ts` 和 `opening/experience.ts`。构造必须同时兼容浏览器和 Node 几何测试/GLB 导出：不能在 module 顶层或 create 中无条件依赖 document；需要字牌时优先复用已有 TextGeometry/font，或提供无 DOM fallback。

## 需要制作的内容

1. **校园巴士**：绿色/暖白方块风，车体中心和尺寸读 `OPENING.bus`，车内出生点读 spawn。门位于西侧 x=63.5、z=32.6，玩家面对西侧下车。车门洞 z=31.9..33.3；不要让车壳/窗/座椅盖住下车通道。车内地板 top=.54，车外三级过渡 .54→.36→.18→地面，台阶范围由 `opening/navigation.ts` 查。后排座椅可在 z>34.4。透明玻璃、简化扶手、校车标牌即可，不开发驾驶系统。
2. **停车/开门**：doorOpen 控制门叶，dt 可为 0，暂停时动画不推进。开门不能移动玩家。渲染开门方向要与实际西侧出口一致。
3. **Building 5**：一楼进门后右转的最小晚宴区域。按 b5 范围建地板/必要内墙、桌椅、绿色白色晚宴布置；Staff 位置 `OPENING.staff`，人物由已有 npcs 模块负责，不再生成一套。
4. **正常/异常两态**：incident=false 桌椅整齐；true 后少量椅子倾倒、遗落物和适度灯光变化，玩家可以辨认事件。不随机扰动通路，不挡住门和主行走线。人物消失由 npcs 负责。
5. **Building 6**：按 b6 范围做最少取电脑空间，地面 top=5.1，桌子与电脑位置读 laptop。世界道具使用现有 `createMacBook()`，laptopAcquired 后隐藏；这里不发物品、不写 flags、不创建手持副本。

## 几何与资源要求

- 复用像素/低模风格，合理人物尺度。玻璃用现有透明材质，不能做成实心板。
- 不重复添加整个校园、建筑主体、NPC 或机器人。建筑 core/幕墙开口由 `geometry.ts` 处理，物理墙由 `navigation.ts` 处理。若发现洞口错误，只提交具体建议。
- 门前、Staff 前、电脑桌前留操作空间；摆桌椅避开 `routeB5/routeB6/routeB4`。家具若需硬碰撞，交付精确 footprint 给集成者接同源数据，不私改共享导航。
- 地板顶面与承托同高；不要让视觉地板浮在角色脚面以上。
- 同类材质/几何复用。无必要不加 shadow light；不加载外部付费资产或新依赖。
- 显式 authorKey/sourceFile/source/confidence 元数据，源码 keys 稳定；不得用 UUID/世界坐标猜身份。动态世界 root 已由 buildSite 标记 dynamicGameplay，不手改 catalog。
- dispose 正确处理自己资源，不能释放现有 MacBook/NPC/校园共享资源；别在 update 每帧重新造模型或材质。
- 房间及巴士尺寸是技术估算，不写“已实景还原”。B06 5.1m 技术入口不等于现有约 9m 高上部玻璃门，保持这个证据边界。

## 验证和交付

新增 Node 几何检查，可用 `createOpeningWorld()` 检查有限 bounds、世界电脑显隐、门状态、incident 切换重复调用、资源可销毁；运行 `./node_modules/.bin/tsx scripts/check-opening-world.ts`。未做浏览器视检就明确写未验证。

交付两个文件、几何假设/家具碰撞需求、接口说明及检查结果。不要自行执行全校园导出或重生成索引。
