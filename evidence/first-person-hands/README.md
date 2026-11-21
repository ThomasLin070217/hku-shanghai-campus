# 第一人称手部修复

- `before-no-hands.jpg`：修复前的第一人称截图。袖管旋转朝向相机背后，被近裁剪面切掉，只剩画面底部的绿色碎片。
- `after-wide.png`：修复后的第一人称空手视图（headless Chromium，1600×1000，S001 学院石牌前）。

修改位置：`src/characters/character.ts` 的 `createFirstPersonArms`。

- 用 `setFromUnitVectors` 将两条前臂从画面下方两侧指向手部，手落在镜头可见范围内。
- 复用角色的外套绿、衬衫袖口和肤色，保持像素方块风格。
- 手部不投射阴影，避免第一人称视图在场景里投影。
- 已验证：`npx tsc --noEmit`；运行时构建、装备 MacBook、释放资源均正常。
