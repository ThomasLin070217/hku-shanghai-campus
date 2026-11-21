# Act 1 Staff dialogue · before / after

只做轻度自然化，不改角色身份、地点、任务和剧情状态。第一幕原有的三句仍保留全部事实；thanks / repeat 是从用户给的测试句补入的短句，用于让“接受任务”和“回来询问”两个瞬间也有声音。

| # | 原文（项目正式版） | 生成/字幕版 | 处理 |
| --- | --- | --- | --- |
| 1 | You're one of our Student Ambassadors, right? | Hey — you're one of the Student Ambassadors, right? | 加 “Hey”，像自然叫住学生；保留确认语气 |
| 2 | We need the presentation MacBook from Building 6 for tonight's dinner. Could you collect it and bring it back here? | Could you do me a quick favour? We need the presentation MacBook from Building 6 for tonight's dinner. | 改成更口语的请求；保留 Building 6 / MacBook / tonight's dinner；“bring it back here” 移到第 4 句 |
| 3 | The device is waiting on the office table in Building 6. | It's on the office table. Mind picking it up? We're running a bit behind. | 把 device 改成 It's；补 “Mind picking it up?” 和 “running a bit behind” 的轻微紧迫感；保留 office table |
| 4 | （原文无） | Perfect, thanks! Just bring it back here when you've got it. | 玩家接受后的自然回应；不改变任务 |
| 5 | （原文无） | Hey — any luck with that laptop? | 玩家没拿电脑就回来时的重复询问；不改变任务 |

## 事实核对

- Building 5 附近的 Staff：保留。
- Student Ambassador 身份：保留。
- 去 Building 6 取 presentation MacBook：保留。
- MacBook 在 office table：保留。
- 拿回 Building 5 交给 Staff：保留。
- High Table Dinner / tonight：保留。
- 任务阶段：仍是 `to_b5 → accept_errand → to_b6 → take_laptop → return_b5`，没有新增或删除任务节点。

## 为什么第 4/5 句不在原 UI 里

原 Staff modal 只有三句正文和一个接受按钮。第 4 句在玩家接受后播放，字幕以 `COORDINATOR — Perfect, thanks!` 显示；第 5 句在玩家回到 Staff 附近且尚未拿电脑时作为可选交互播放。两段都不阻塞任务，也不改变原剧情。

原文与修改版同时保存在 `content/voice/staff-dialogue.ts` 的 `STAFF_DIALOGUE.original`，方便后续 review。
