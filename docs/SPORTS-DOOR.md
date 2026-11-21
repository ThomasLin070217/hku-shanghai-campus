# 体育馆东门 · 玻璃门与数独门禁

2026-11-20 加入的虚构玩法内容。体育馆在 C03/R02 证据里是一个封闭体块，这扇门和门锁都不是实景观察结果。

## 位置与尺寸

- 体育馆 `Sports_Hall` 中心 `(-68, -117)`，东墙 `x≈-48.5`，门洞 3.2 × 2.7 m，双开玻璃门。
- 参数在 `src/model/sportsDoor.ts` 的 `SPORTS_HALL` / `SPORTS_DOOR`；模型、碰撞和交互共用同一组常量，改宽度或位置只需要改这里。
- 场景编号：`A014-G-cccb234fca54`（“体育馆东门 · 玻璃门与门禁锁”），`npm run scene -- find 门` 可查。

## 碰撞

体育馆原来是 `sports-hall-closed` 单个实心方块。现在拆成 `sports-hall-west/north/south/east`、`sports-hall-lintel` 和 `sports-hall-roof`，门洞单独是 `sports-east-door`，可通过 `world.setDoorOpen(id, open)` 开关；`support()` 在馆内返回 0.3 m 地面高度。

## 两道锁

### 第一道：9×9 数独

- 数据：`content/puzzles/sports-hall-lock.json`（9×9，`*` 表示空格，共 4 个空）。
- 校验：`src/gameplay/sudokuPuzzle.ts` 在加载时把 `answer` 填进空格并要求整格合法；答案与题面不一致会直接报错。
- 按**从上到下、从左到右**读 4 个空格，得到 `1911`。
- 填满后点「确认」，正确则进入第二道锁。

### 第二道：4 位数字密码

- 同一份 JSON 的 `password` 段：`length: 4`、`answer: "1911"`、`hint: "HKU 建校时间"`。
- 界面显示 4 个数字位和屏幕键盘（1–9、0、←、确认），提示写在面板上。
- 密码错误会清空重填；只有 4 位都填满并点「确认」才校验，正确才开锁。

> 备注：曾提出把数独答案改成 `19110311`（建校日期 1911-03-11），但数独格只能是 1–9，不能出现 0，所以数独保持 4 个空、答案 `1911`；`19110311` 里的年份部分作为第二道密码，用「HKU 建校时间」提示玩家。

## 馆内的 100 名学生

- 位置与外观：`src/gameplay/studentCrowd.ts`；复用主角模型（`createStudent()`，绿袍），保证与玩家角色同款。
- 构成（按人数比例）：本地男生 40、本地女生 40、非洲裔 3+4、南亚裔 4+3、欧美裔 3+3。
  - **20% 为国际学生**，覆盖 3 个地区、至少 5 种肤色（`CROWD.internationalShare`）。
  - **50% 为女生**，使用 `hairStyle:'long'`：贴图侧后方长发 + 三块几何（后发、两侧发绺），身高略矮、体型略窄（`CROWD.femaleShare`）。
  - 想全女/全男只改 `CROWD.femaleShare`（1 / 0）；想调整国际比例改 `CROWD.internationalShare`。人数变化后 `crowdVariants()` 会自动把余数分配到各地区。
- **随机散布**：在馆内按最小间距 1.05 m 做拒绝采样，朝向以大门为基准随机 ±0.9 rad；门口 2.8 m 内留空。
- **性能**：8 个外观变体共用一张纹理图集（48 个切片）和 2 个材质；每个变体 2 个 InstancedMesh（贴图身体 + 顶点色配件），合计 **16 个 draw call、21 000 个三角形**。
- 没有碰撞体：100 个碰撞会把门口堵死，因此学生可穿过。

## 营救提示

输入正确密码、门锁解除时，屏幕中央弹出英文提示：

> **You have successfully rescued the students!**
> 100 students are safe. The hall is clear.

8 秒后自动淡出，点击任意位置也可关闭。文案在 `src/gameplay/sportsDoor.ts` 的 `banner` 元素里。

## 交互与状态

- 走近东门出现 `F 检查门禁锁`，按 F 打开面板（游戏暂停、指针解锁）。
- 数独：填满 4 个空点「确认」，错误保留已填内容可重试，没填满提示剩余空格数。
- 密码：4 位数字 + 「确认」，错误清空重填。
- 两道都通过才解除门锁并播放开门动画；数独通过后关闭面板，再按 F 会直接进入密码这一步。
- 门的状态存 `CampusGame.doors['sports-east-door']`，随存档持久化（`save.ts`），刷新后仍然打开；“重新开始”会重新上锁。
- 开发钩子（仅 dev/review）：`__CAMPUS.door.unlock()` / `.lock()` / `.state`。

## 已知边界

- 馆内目前是空的，只有地坪和屋顶。
- 门锁只能用鼠标操作，AI `/act` 目前不能开这扇门。
- 自动化浏览器（Playwright）拒绝指针锁定，关门后面板会退回暂停卡片；真实 Chrome 里点击“确认/关闭”即可恢复鼠标锁定。
