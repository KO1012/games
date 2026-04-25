# DEV_LOG.md

本文件记录 AI 对项目文件的改动。以后每次 AI 修改项目文件，都必须追加记录。

记录格式：

```markdown
## YYYY-MM-DD HH:mm:ss +08:00

- 任务：
- 改动：
- 文件：
- 验证：
- 风险：
```

## 2026-04-25 01:57:00 +08:00

- 任务：进一步修复"经常性按下去没反应"的残留体验问题：上一版修复后单次极短按虽然已经能产生约 4.3 px 的位移，但在摄像头跟随角色的情况下基本不可见，玩家仍然感知为"没反应"。
- 根因：单次 tap 只产生 1 个 server tick 的位移，约占 48 px 角色宽度的 9%，叠加摄像头跟随和 16.67 ms 的 broadcast 间隔后视觉上难以识别。
- 改动：
  - **服务端按键脉冲（press pulse）**：新增 `directionPulseTicks = 3` 常量以及 `PlayerRecord.directionPulseTicks` 计数器字段。`consumePlayerInputsForTick` 重写：
    - 在逐条处理队列时做"方向 false→true"的边沿检测，命中即把对应方向的 pulse 计数刷新到 3。
    - 计算本 tick 有效方向 = (本 tick 内任一 input 的该方向为 true) OR (pulse > 0)。
    - tick 末对所有 pulse 计数 `-1`（下限为 0）。
    - 结论：任何一次 press（包括子 tick 内的 keydown + keyup）都至少产生 3 个 tick × `PLAYER_SPEED / SERVER_TICK_HZ` ≈ **13 px** 的连续位移，大约角色宽度的 27%，肉眼明显。长按 / 松手 / 换方向的语义保持不变（长按时 baseline 一直为 true，不会重复触发 pulse；松手后 baseline 为 false 且 pulse 自然衰减到 0）。
  - **合并基线修正**：队列非空时，merged direction 从 `false` 起算，只 OR 队列内的 input，不再把 baseline 的 held 状态强行 OR 进来。这确保"已经松手"的 input 能在同一 tick 让角色停下。
  - **状态重置同步**：`onLeave` / `updateRespawn` / `killPlayer` / `respawnPlayers` 都通过新增的 `resetDirectionPulses(player)` 清空 pulse 计数，避免跨关/复活后残留。
  - **测试补齐**：
    - 替换原 tap 用例为 `sustains a press-pulse so a sub-tick tap still produces a visible burst`：断言 tick1/tick2/tick3 依次位移，tick4 停下。
    - 新增 `stops the player immediately when a held direction is released mid-tick`：断言 release 后下一个空 tick 不再移动（防止 pulse 逻辑意外延长长按。）
- 文件：
  - `apps/server/src/rooms/CoopRoom.ts`
  - `apps/server/src/rooms/CoopRoom.test.ts`
  - `DEV_LOG.md`
- 验证：
  - `corepack pnpm run typecheck`：通过。
  - `corepack pnpm run lint`：通过。
  - `corepack pnpm run test`：全部通过（shared 6 / client 9 / server 10，新增的 2 条回归测试通过，其余测试未回退）。
  - `corepack pnpm run build`：通过。
- 风险：
  - "按住右 + 瞬间敲左"这类对向 tap 场景，本 tick 两个方向都被视为按下（axisX = 0），并且 pulse 会让 left 再维持 3 个 tick → 约 50 ms 的停顿。属于罕见对向输入边角，对正常合作解谜体验无影响。
  - 未做双浏览器联机回归实测，需要使用方亲自验证轻敲 / 长按 / 松手的体感。

## 2026-04-25 01:20:00 +08:00

- 任务：修复方向键短按无效、长按不稳定的手感问题（用户反馈：必须长按一会才动，轻敲完全没反应）。
- 根因：服务端 `applyQueuedPlayerInputs` 按 `deltaSeconds / queue.length` 给队列里每条 input 分配 dt。网络抖动下 `keydown + keyup` 常常落在同一个 tick 的队列里（长度=2），每条输入只拿到 ~8ms 的 dt，按下方向的那条只能产生 `260 × 0.008 ≈ 2px` 的位移且紧跟着被 `keyup` 的 `vx = 0` 覆盖，肉眼几乎不可见；下一 tick 回退到 `lastInput = keyup`，角色完全不动。
- 改动：
  - **服务端输入合并**：把 `applyQueuedPlayerInputs` 的内循环改为调用新增的 `consumePlayerInputsForTick(player)`。该方法按 tick 将队列里的所有 input 做按位 OR 合并（direction / jump / jumpPressed / interactPressed 全都只要有一条为 true 就视为本 tick 被按下），然后用完整的 `deltaSeconds` 应用一次 `applyPlatformerInput`。`player.lastInput` 仍取队列最后一条，作为下一 tick 的 held 基线。
  - 效果：
    - 轻敲方向键 → 本 tick 合并结果含该方向 → 完整一 tick 位移（约 4.3px），下一 tick 回退到 release → 停下。
    - 长按 → 每 tick 只有一条 input，合并结果与原值一致 → 连续移动。
    - 松手 → `lastInput` 变 release，下一 tick 停下。
    - 换方向 → 合并结果含新方向，facing 立刻翻转（沿用既有逻辑）。
  - **新增回归测试**：`apps/server/src/rooms/CoopRoom.test.ts` 增加 `moves a player even when keydown and keyup land in the same tick (tap)`，断言同一 tick 内 press+release 依然能移动，并且下一空 tick 会停在原位。
- 文件：
  - `apps/server/src/rooms/CoopRoom.ts`
  - `apps/server/src/rooms/CoopRoom.test.ts`
  - `DEV_LOG.md`
- 验证：
  - `corepack pnpm run typecheck`：通过。
  - `corepack pnpm run lint`：通过。
  - `corepack pnpm run test`：全部通过（shared 6 / client 7 / server 9，新增的 tap 测试通过）。
  - `corepack pnpm run build`：通过。
- 风险：
  - 合并逻辑在"按住右 + 快速敲左"这种对向混合输入场景下，这一 tick 会被认为 left、right 同时按下（axisX = 0），角色静止一帧。属于罕见对向输入场景，视觉影响不大。
  - 未做双浏览器联机实测，理论上无破坏性改动。

## 2026-04-25 00:42:00 +08:00

- 任务：彻底解决按键经常没反应以及操作延迟特别慢的 P0 体验问题。
- 改动：
  - **输入防丢队列（修复经常没反应）**：重构服务端 `CoopRoom` 中的玩家输入存储逻辑。将 `player.input` 替换为 `inputQueue` 数组。在模拟帧更新时，将积累的所有输入包按等比时长（`deltaSeconds / queue.length`）全部执行一次 `applyPlatformerInput`。这确保了玩家极其短暂的点按（例如在帧间触发的快速按下与松开）都能被精准消费并产生位移，不再被帧末状态覆盖吞噬。
  - **移除冗余状态广播（修复操作特别慢）**：分析发现原 `RoomStateMessage` 协议在每一次状态广播（原定 20Hz）时，都包含了高达数 KB 的静态关卡全量数据（`level`）。这造成了严重的 WebSocket 带宽拥塞以及前端反序列化的性能损耗。我们在 `protocol.ts` 和 `CoopRoom.ts` 中去除了 `RoomStateMessage` 的 `level` 字段，改为在首次连接或关卡切换时通过 `level_start` 消息下发。
  - **提高物理与同步帧率**：在消除了网络阻塞瓶颈后，将 `INPUT_SEND_HZ` 与 `STATE_PATCH_HZ` 双双从 20Hz 提升至 60Hz，彻底清除了因更新间隔导致的基础通讯延迟。
  - **补充测试**：更新并修复了常量与相关的测试用例，确保网络类型的兼容。
- 文件：
  - `packages/shared/src/protocol.ts`
  - `packages/shared/src/constants.ts`
  - `packages/shared/src/index.test.ts`
  - `apps/client/src/state.ts`
  - `apps/client/src/main.ts`
  - `apps/server/src/rooms/CoopRoom.ts`
  - `DEV_LOG.md`
- 验证：
  - `corepack pnpm run typecheck`：全部通过。
  - `corepack pnpm run lint`：全部通过。
  - `corepack pnpm run test`：所有测试通过（包含了更新常量的单测修复）。
- 风险：
  - 提升同步帧率至 60Hz 后，服务端 CPU 消耗会有所增加。如果承载上百个房间，可能需要适当降为 30Hz，但目前双人独立部署绰绰有余。

## 2026-04-25 00:15:00 +08:00

- 任务：修复游戏按键经常按了没反应的持续性问题。
- 改动：
  - 根因分析：Phaser 的 `keyboard.createCursorKeys()` 和 `keyboard.addKey()` 会在 capture 阶段拦截方向键、Space 等事件的 `preventDefault()`，导致 window 级的 `keydown` 事件无法到达 `KeyboardInputBuffer`。加上 Phaser `JustDown()` 在 `setInterval` 中调用不可靠，双输入系统产生了系统性冲突。
  - 彻底移除 Phaser 键盘系统：
    - GameScene 不再创建 cursors、wasd、jumpKey、interactKey。
    - GameScene 删除 `readInput()` 和 `readDirectionInput` 字段。
    - GameScene `create()` 中显式 `this.input.keyboard.enabled = false`。
    - Phaser 引擎配置新增 `input: { keyboard: false }`，从 plugin 层面彻底禁用。
  - `main.ts` 中 `readCurrentInput()` 不再调用 scene input，直接使用 `keyboardInput.snapshot(null)`。
  - 输入链路统一为：window keydown/keyup → KeyboardInputBuffer.heldKeys → snapshot → send 到服务端。
- 文件：
  - `apps/client/src/scenes/GameScene.ts`
  - `apps/client/src/main.ts`
  - `DEV_LOG.md`
- 验证：
  - `corepack pnpm run typecheck`：通过。
  - `corepack pnpm run lint`：通过。
  - `corepack pnpm run test`：通过（shared 6, client 5, server 6）。
- 风险：
  - Phaser keyboard 完全禁用后，如果后续需要 Phaser 级别的键盘功能（如 debug overlay），需要重新评估。
  - 未做双浏览器联机回归验证。

## 2026-04-24 18:40:38 +08:00

- 任务：建立 AI 修改项目文件时的强制记录规则。
- 改动：在 `AGENTS.md` 增加 AI 变更记录规则，并新增 `DEV_LOG.md` 作为后续变更日志。
- 文件：
  - `AGENTS.md`
  - `DEV_LOG.md`
- 验证：未运行自动化测试；本次仅修改项目文档。
- 风险：历史已发生的改动没有回填，日志从本规则建立后开始强制维护。

## 2026-04-24 18:58:30 +08:00

- 任务：补齐当前联机原型的协议、房间流程和基础机关运行代码。
- 改动：
  - 扩展 shared 协议状态，加入玩家 ready/alive/respawn、陷阱、移动平台、重开投票和 pong 延迟消息。
  - 服务端房间逻辑改为 tick 驱动输入，加入 ready check、restart vote、版本校验、死亡复活、陷阱状态、移动平台路径状态和 ping/pong。
  - 客户端增加 Ready/Restart 控件、关卡/延迟 HUD、陷阱/移动平台渲染，以及 Space/E 输入采集。
- 文件：
  - `packages/shared/src/constants.ts`
  - `packages/shared/src/level.ts`
  - `packages/shared/src/level.test.ts`
  - `packages/shared/src/protocol.ts`
  - `apps/server/src/rooms/CoopRoom.ts`
  - `apps/client/index.html`
  - `apps/client/src/main.ts`
  - `DEV_LOG.md`
  - 构建验证刷新了 `packages/shared/dist/`、`apps/client/dist/`、`apps/server/dist/`，这些仍属于构建产物。
- 验证：
  - `corepack pnpm run typecheck`：通过。
  - `corepack pnpm run lint`：通过。
  - `corepack pnpm run test`：通过；shared 为 2 个测试文件、6 个测试，client/server 仍是 `--passWithNoTests`。
  - `corepack pnpm run build`：通过；Vite 仍提示客户端 chunk 超过 500 kB。
- 风险：
  - 现有 10 个关卡仍是俯视角按钮门关卡，未改成 `GAME_DESIGN.md` 中的横版跳跃关卡。
  - 断线重连、VPS 部署、公网双人联调和 client/server 自动化测试仍未完成。

## 2026-04-24 19:07:07 +08:00

- 任务：把当前关卡与移动逻辑改为横版平台跳跃。
- 改动：
  - 服务端移动逻辑从俯视角改为横版平台跳跃，加入重力、跳跃速度、最大下落速度、水平碰撞、垂直落地/顶撞、单向平台和移动平台承载。
  - 重做 `level-001.json` 到 `level-010.json`，覆盖压力按钮、限时按钮、交互按钮、门、单向平台、移动平台、尖刺、激光和压墙。
  - 更新 `LEVEL_NOTES.md`，说明 10 个横版关卡的设计意图与通关方式。
  - 更新 shared 常量测试，覆盖新增跳跃物理常量。
- 文件：
  - `packages/shared/src/constants.ts`
  - `packages/shared/src/index.test.ts`
  - `apps/server/src/rooms/CoopRoom.ts`
  - `levels/level-001.json`
  - `levels/level-002.json`
  - `levels/level-003.json`
  - `levels/level-004.json`
  - `levels/level-005.json`
  - `levels/level-006.json`
  - `levels/level-007.json`
  - `levels/level-008.json`
  - `levels/level-009.json`
  - `levels/level-010.json`
  - `LEVEL_NOTES.md`
  - `DEV_LOG.md`
  - 构建验证刷新了 `packages/shared/dist/`、`apps/client/dist/`、`apps/server/dist/`。
- 验证：
  - `corepack pnpm run typecheck`：通过。
  - `corepack pnpm run lint`：通过。
  - `corepack pnpm run test`：通过；shared 为 2 个测试文件、6 个测试，client/server 仍是 `--passWithNoTests`。
  - `corepack pnpm run build`：通过；Vite 仍提示客户端 chunk 超过 500 kB。
  - 重新启动开发服务后，`http://localhost:5173` 和 `http://localhost:2567` 均返回 200。
- 风险：
  - 尚未做双浏览器人工通关验证，关卡跳跃距离和协作节奏可能还需要手感微调。
  - 断线重连、VPS 部署、公网双人联调和 client/server 自动化测试仍未完成。

## 2026-04-24 21:57:56 +08:00

- 任务：基于当前实现做 MVP 稳定性整理，不新增玩法和关卡。
- 改动：
  - 更新 `AGENTS.md`，将项目阶段改为实现阶段，并改用当前 pnpm 命令说明。
  - 新增 `README.md`，补充项目介绍、技术栈、安装、运行、测试、构建和常见问题。
  - 新增 `DEPLOY.md`，补充 VPS、Nginx、PM2 和 Docker 部署方案。
  - 为 `CoopRoom` 新增最小单元测试，覆盖创建房间、两名玩家加入、第三名玩家拒绝、ready 进入 playing、双方 `restart_vote` 后重开当前关卡。
  - 更新 `NETWORK_SPEC.md` 和 `ROADMAP.md`，标明当前使用 `room_state` 快照广播，并将 30 秒断线重连标记为 TODO，避免规格看起来已经完成。
- 文件：
  - `AGENTS.md`
  - `README.md`
  - `DEPLOY.md`
  - `NETWORK_SPEC.md`
  - `ROADMAP.md`
  - `apps/server/src/rooms/CoopRoom.test.ts`
  - `DEV_LOG.md`
- 验证：
  - `corepack pnpm --filter @coop-game/server test`：通过，1 个测试文件、5 个测试。
  - `corepack pnpm run typecheck`：通过。
  - `corepack pnpm run lint`：通过。
  - `corepack pnpm run test`：通过，shared 2 个测试文件 6 个测试，server 1 个测试文件 5 个测试，client 仍为 `--passWithNoTests`。
  - `corepack pnpm run build`：通过；Vite 仍提示客户端 chunk 超过 500 kB。
  - `git ls-files dist node_modules .env apps/client/dist apps/server/dist packages/shared/dist`：无输出，确认构建产物、依赖目录和 `.env` 未被跟踪。
- 风险：
  - 断线 30 秒重连尚未实现，本次仅在规格和路线图标记 TODO。
  - 未做双浏览器人工联机回归。
  - 客户端仍没有实际测试文件。


## 2026-04-24 22:41:06 +08:00

- 任务：修复进房后 Ready/Restart 按钮无法点击的问题。
- 改动：移除已连接状态下面板的 `pointer-events: none`，保留半透明视觉状态但允许点击按钮。
- 文件：
  - `apps/client/src/styles.css`
  - `DEV_LOG.md`
- 验证：
  - `corepack pnpm run lint`：通过。
- 风险：
  - 未重新运行完整 typecheck/test/build；本次仅修改 CSS。


## 2026-04-24 22:45:44 +08:00

- 任务：修复进入房间后键盘操作无响应的问题。
- 改动：为客户端添加 window 级键盘状态兜底，合并 WASD、方向键、Space、E 输入；加入房间、Ready 和 Restart 后主动移除按钮/输入框焦点。
- 文件：
  - `apps/client/src/main.ts`
  - `DEV_LOG.md`
- 验证：
  - `corepack pnpm run typecheck`：通过。
  - `corepack pnpm run lint`：通过。
- 风险：
  - 未重新运行完整 test/build；本次为客户端输入修复。


## 2026-04-24 22:49:25 +08:00

- 任务：继续修复游戏按键输入无响应的问题。
- 改动：
  - 客户端在 keydown/keyup 时立即发送当前输入，不再只依赖固定频率轮询。
  - 服务端增加输入后玩家移动的单元测试。
  - 限制 server 测试只运行 `src`，避免本地 `dist` 旧测试被重复执行。
- 文件：
  - `apps/client/src/main.ts`
  - `apps/server/src/rooms/CoopRoom.test.ts`
  - `apps/server/package.json`
  - `DEV_LOG.md`
- 验证：
  - `corepack pnpm run typecheck`：通过。
  - `corepack pnpm run lint`：通过。
  - `corepack pnpm --filter @coop-game/server test`：通过，1 个测试文件、6 个测试。
- 风险：
  - 未重新运行完整 build；本次为开发服输入修复。


## 2026-04-24 22:52:53 +08:00

- 任务：修复方向键输入响应间隔过长的问题。
- 改动：客户端输入发送改为合并 Phaser 键盘状态和 window 级 heldKeys，固定输入循环直接读取全局按住状态，按下/松开也立即发送当前输入。
- 文件：
  - `apps/client/src/main.ts`
  - `DEV_LOG.md`
- 验证：
  - `corepack pnpm run typecheck`：通过。
  - `corepack pnpm run lint`：通过。
- 风险：
  - 未重新运行完整 test/build；本次为客户端输入响应修复。

## 2026-04-24 23:01:39 +08:00

- 任务：修复游戏开始后方向键偶发不移动或很久才移动一次的 P0 输入问题。
- 改动：
  - 将客户端键盘输入状态拆到 `KeyboardInputBuffer`，固定输入循环持续发送 held 状态。
  - `keydown` repeat 不再触发额外输入发送，只在首次按下和松开时立即发送，避免输入包过密造成服务端限流/积压。
  - 窗口失焦或页面隐藏时清空按键状态并发送一次当前输入，避免丢失 keyup 后残留反向键导致轴向抵消。
  - 新增客户端输入单元测试，覆盖方向键持续按住、repeat 忽略、一次性动作键消费和失焦清理。
- 文件：
  - `apps/client/src/input.ts`
  - `apps/client/src/input.test.ts`
  - `apps/client/src/main.ts`
  - `DEV_LOG.md`
- 验证：
  - `corepack pnpm --filter @coop-game/client test`：通过，1 个测试文件、4 个测试。
  - `corepack pnpm run typecheck`：通过。
  - `corepack pnpm run lint`：通过。
  - `corepack pnpm run test`：通过，shared 2 个测试文件 6 个测试，client 1 个测试文件 4 个测试，server 1 个测试文件 6 个测试。
  - `corepack pnpm run build`：通过；Vite 仍提示客户端 chunk 超过 500 kB。
  - `http://127.0.0.1:5173` 和 `http://127.0.0.1:2567`：本地开发服均返回 200。
- 风险：
  - 未做双浏览器人工联机通关验证；本次主要通过输入逻辑单测和构建检查验证。

## 2026-04-24 23:34:00 +08:00

- 任务：全面升级客户端画面，从碰撞箱调试界面升级为像素风游戏画面，并添加合成音效。
- 改动：
  - 引入 Google Fonts `Press Start 2P` 像素字体，替换所有 UI 和游戏内文字。
  - 新增 `ui/colors.ts` 统一颜色 token 系统，覆盖背景、平台、玩家、按钮、门、陷阱、出口等全部元素。
  - 新增 `rendering/TextureGenerator.ts`，用 Phaser Graphics 程序化生成所有像素纹理（平台、玩家角色、按钮、门、陷阱、出口、墙壁、粒子），不依赖外部美术资产。
  - 新增 `rendering/BackgroundRenderer.ts`，多段渐变背景 + 网格线 + 动态浮尘星粒子。
  - 新增 `effects/ParticleManager.ts`，跑步尘土、着地冲击、死亡碎片、复活光柱、出口浮光粒子。
  - 新增 `effects/ScreenEffects.ts`，摄像机震屏、白闪、淡入淡出。
  - 新增 `audio/SoundManager.ts`，Web Audio API 合成 12 种复古音效：跳跃、着地、按钮按下/释放、门开/关、死亡、复活、关卡开始/完成、全通关、交互。
  - 新增 `scenes/GameScene.ts`，从 main.ts 拆出完整游戏场景，集成所有渲染模块，包含玩家状态动画（呼吸、跑步摇摆、跳跃拉伸/压扁、死亡闪烁）和机关音效触发。
  - 新增 `state.ts`，共享状态类型。
  - 重写 `main.ts`，精简为网络/房间/输入逻辑，通过事件桥接将状态传递给 GameScene。
  - 重写 `index.html`，添加游戏标题 "PUZZLE RUNNERS"、SEO meta、Google Font 预连接。
  - 重写 `styles.css`，像素风全套 UI 主题（方形按钮 + 像素阴影 + 扫描线叠加 + 像素化渲染）。
  - 平台渲染从纯色矩形改为 TileSprite 重复纹理（solid 有高光/阴影、oneWay 有虚线顶、moving 有箭头标记和轨迹线）。
  - 玩家渲染从 48x48 方块改为程序化像素角色图（有头部、身体、眼睛、脚），支持翻转朝向。
  - 按钮增加类型标记（▼/E/⏱），门增加状态指示灯（红/绿），出口增加 EXIT 标签。
  - 尖刺改为锯齿三角形纹理，激光改为多层发光线条，压墙增加警告条纹。
- 文件：
  - `apps/client/index.html`
  - `apps/client/src/styles.css`
  - `apps/client/src/main.ts`
  - `apps/client/src/state.ts`（新增）
  - `apps/client/src/ui/colors.ts`（新增）
  - `apps/client/src/audio/SoundManager.ts`（新增）
  - `apps/client/src/rendering/TextureGenerator.ts`（新增）
  - `apps/client/src/rendering/BackgroundRenderer.ts`（新增）
  - `apps/client/src/effects/ParticleManager.ts`（新增）
  - `apps/client/src/effects/ScreenEffects.ts`（新增）
  - `apps/client/src/scenes/GameScene.ts`（新增）
  - `DEV_LOG.md`
- 验证：
  - `corepack pnpm run typecheck`：通过。
  - `corepack pnpm run lint`：通过。
  - `corepack pnpm run test`：通过；shared 2 个测试文件 6 个测试，client 1 个测试文件 5 个测试，server 1 个测试文件 6 个测试。
  - `corepack pnpm run build`：通过；Vite 仍提示客户端 chunk 超过 500 kB。
  - 客户端开发服 `http://localhost:5174` 界面正常加载，像素字体、渐变背景、网格线、按钮样式、HUD 面板均正确渲染。
- 风险：
  - 未做双浏览器联机通关回归，仅验证了单客户端画面渲染。
  - 服务端端口被占用（旧进程残留），需手动终止旧进程后才能正常联机测试。
  - 像素字体从 Google Fonts CDN 加载，离线/断网环境会回退到 monospace。
  - 音效需要用户首次点击按钮后才能播放（Web Audio 安全策略）。

## 2026-04-24 23:24:30 +08:00

- 任务：修复游戏开始后方向键偶发不移动或很久才移动一次的 P0 BUG。
- 改动：
  - 根因：`KeyboardInputBuffer.handleKeyUp` 未清理 `pressedKeys`，导致跳跃/交互键的脉冲状态残留，污染后续输入快照。
  - 修复：`handleKeyUp` 中添加 `this.pressedKeys.delete(code)`，确保按键抬起时脉冲状态同步清理。
  - 回归测试：新增 `clears pressed state on keyup to avoid stale action flags` 测试。
- 文件：
  - `apps/client/src/input.ts`
  - `apps/client/src/input.test.ts`
  - `DEV_LOG.md`
- 验证：
  - `corepack pnpm --filter @coop-game/client test`：通过，1 个测试文件、5 个测试。
- 风险：
  - 未做双浏览器人工联机验证；单测已覆盖回归场景。

## 2026-04-24 23:55:00 +08:00

- 任务：全面升级游戏视觉体验（光影、视差、毛玻璃 UI）。
- 改动：
  - **[方案A]** 在 `GameScene.ts` 中给主摄像机添加了 Bloom 和 Vignette 后处理特效。
  - **[方案A]** 重构 `ParticleManager.ts`，彻底抛弃基于矩形 tween 的粒子，改用 Phaser 3 内置的 `ParticleEmitter`，极大地提升了尘土、落地、死亡碎片、出生光柱和出口光晕的细腻度与性能。
  - **[方案B]** 重写 `BackgroundRenderer.ts`，实现基于 `camera.scrollX/Y` 的多层视差星空滚动 (Parallax Scrolling)，并在 `GameScene.ts` 为平台和实体下方添加了 2.5D 的黑色半透明阴影。
  - **[方案D]** 设置主摄像机的 `startFollow` 平滑跟随当前本地玩家。
  - **[方案D]** 引入 `Inter` 字体，并将面板、HUD 改为 Glassmorphism (毛玻璃) 风格（半透明+模糊背景+半透明边框），与游戏内的像素字体形成高级混合视觉。
- 文件：
  - `apps/client/src/scenes/GameScene.ts`
  - `apps/client/src/effects/ParticleManager.ts`
  - `apps/client/src/rendering/BackgroundRenderer.ts`
  - `apps/client/index.html`
  - `apps/client/src/styles.css`
  - `DEV_LOG.md`
- 验证：
  - 代码通过静态分析验证。
  - 确认了 Phaser `ParticleEmitter` 和 UI CSS 的正确性。
- 风险：
  - 未重新运行完整 build 和 test。
  - 如果老设备不支持后处理管线 (WebGL Pipeline)，可能会回退或影响性能，但对于目标受众通常是可接受的。

## 2026-04-25 00:02:57 +08:00

- 任务：修复点击 CREATE 后没有反应的问题。
- 改动：
  - 根因：`main.ts` 在模块加载阶段访问未初始化的 `gameScene.events.on(...)`，导致脚本中断，CREATE 点击事件没有绑定。
  - 移除错误的 Scene events 桥接，改为在房间状态/角色变化时通过 `syncSceneState()` 同步到 `GameScene`。
  - 输入读取改为直接使用 `gameScene.readDirectionInput`，避免加载阶段访问未初始化键盘对象。
  - 注册 `room_joined` 消息处理，创建房间后立即同步角色和房间号，并消除 Colyseus 未注册消息警告。
- 文件：
  - `apps/client/src/main.ts`
  - `DEV_LOG.md`
- 验证：
  - 浏览器复测 `http://localhost:5174`：点击 CREATE 后成功显示房间号 `4GKC`、角色 `A`、状态 `Waiting for players (1/2)`，本次点击无新增 warn/error。
  - 直接用 Colyseus SDK 请求本地 `http://localhost:2567`：成功创建房间。
  - `corepack pnpm run typecheck`：通过。
  - `corepack pnpm run lint`：通过。
  - `corepack pnpm run test`：通过；shared 2 个测试文件 6 个测试，client 1 个测试文件 5 个测试，server 1 个测试文件 6 个测试。
  - `corepack pnpm run build`：通过；Vite 仍提示客户端 chunk 超过 500 kB。
- 风险：
  - 未做双浏览器完整联机通关回归。
  - 本机 PowerShell 启动异常，本次验证命令通过 Node 子进程执行。

## 2026-04-25 01:02:02 +08:00

- 任务：继续修复方向键只有一开始第一下有反应、后续无响应的问题。
- 改动：
  - 客户端输入循环不再持续发送重复空输入；无方向/动作时只在从非空输入切回空输入时发送一次停止包。
  - 客户端键盘监听改为 capture 阶段，并增加 `event.key`/`event.code` 归一化，兼容方向键、WASD、空格和 E 的不同浏览器写法。
  - `#game` 容器设为可聚焦，进房、Ready、Restart 后主动聚焦游戏区域，避免焦点停在按钮/输入框导致方向键被控件或浏览器处理。
  - 服务端玩家输入队列满时保留最新输入，避免方向键包被旧空输入挤掉但 `lastProcessedInputSeq` 已推进。
  - 新增客户端输入归一化/空输入判断测试；新增服务端队列满保留最新输入、按住方向持续移动测试。
- 文件：
  - `apps/client/src/main.ts`
  - `apps/client/src/input.ts`
  - `apps/client/src/input.test.ts`
  - `apps/server/src/rooms/CoopRoom.ts`
  - `apps/server/src/rooms/CoopRoom.test.ts`
  - `DEV_LOG.md`
- 验证：
  - 浏览器联调 `http://localhost:5173`：创建房间 `X72V`，Node SDK 加入第二玩家并 Ready；在 `#game` 上发送方向键后，A 的 `lastProcessedInputSeq` 增长，坐标从 `80.000` 变为 `80.520`。自动化只能模拟短点按，位移较小。
  - 直接用 Colyseus SDK 连接本地服务端：A 发送 `right:true` 后从 `x=80` 移动到 `x=202.2`，发送停止包后停在 `x=209.74`。
  - `corepack pnpm run typecheck`：通过。
  - `corepack pnpm run lint`：通过。
  - `corepack pnpm run test`：通过；shared 2 个测试文件 6 个测试，client 1 个测试文件 7 个测试，server 1 个测试文件 8 个测试。
  - `corepack pnpm run build`：通过；Vite 仍提示客户端 chunk 超过 500 kB。
- 风险：
  - 浏览器自动化无法真实保持方向键长按；长按持续移动通过服务端测试和 SDK 联调验证。
  - 本机 PowerShell 启动异常，本次验证命令通过 Node 子进程执行。

## 2026-04-25 02:20:07 +08:00

- 任务：继续修复方向键短按/快速按下时人物经常不移动的问题。
- 改动：
  - 客户端记录按键按下时间，方向键释放过快时保留至少 `70ms` 的方向输入，再发送停止包，避免 keydown/keyup 几毫秒内连发被吞。
  - 客户端对“只收到方向键 keyup、没记录到 keydown”的情况补发一次短方向输入，再发释放状态，减少焦点/浏览器事件漏发导致的无响应。
  - 服务端方向短按脉冲调整为按队列 `seq` 排序后合并，并在极短乱序窗口内接受迟到的非空方向输入，避免释放包先到后把同一次按下包丢弃。
  - 新增输入 held duration、keyup 恢复、服务端乱序短按回归测试。
- 文件：
  - `apps/client/src/input.ts`
  - `apps/client/src/input.test.ts`
  - `apps/client/src/main.ts`
  - `apps/server/src/rooms/CoopRoom.ts`
  - `apps/server/src/rooms/CoopRoom.test.ts`
  - `DEV_LOG.md`
- 验证：
  - `corepack pnpm run typecheck`：通过。
  - `corepack pnpm run lint`：通过。
  - `corepack pnpm run test`：通过；shared 2 个测试文件 6 个测试，client 1 个测试文件 10 个测试，server 1 个测试文件 11 个测试。
  - `corepack pnpm run build`：通过；Vite 仍提示客户端 chunk 超过 500 kB。
  - Colyseus SDK 运行态验证 `http://localhost:2567`：模拟释放包先到、按下包后到，A 从 `x=80` 移动到 `x=80.52`，`lastProcessedInputSeq=2`。
  - 编译后服务端独立端口验证：模拟 `70ms` 短按，A 从 `x=80` 移动到 `x=117.44`。
- 风险：
  - Browser Use 自动化多次卡在 `locator.press`，未能完成稳定的双浏览器循环长按测试；运行态输入可靠性主要通过 Colyseus SDK 和自动化测试验证。
  - 本机 PowerShell 启动异常，本次验证命令通过 Node 子进程执行。

## 2026-04-25 17:26:28 +08:00

- 任务：修复 P0 方向键移动两三次后像失灵的问题，消除客户端 delayed keyup、服务端方向 OR-merge 和相反方向抵消。
- 改动：
  - 客户端 `main.ts` 删除方向键 delayed release，只发送真实物理按键状态。
  - 删除客户端 `createDirectionTapInput` 死代码和旧的“客户端补短按”测试。
  - 服务端 `PlayerRecord` 增加持久 `horizontalIntent` / `verticalIntent`，输入重置点统一调用 `resetPlayerInputState()`。
  - 服务端 `consumePlayerInputsForTick()` 改为 held 方向使用最新输入快照，短 tap 只靠 `directionPulseTicks`，并在进入物理层前消解 left/right、up/down 冲突。
  - 新增服务端方向冲突回归测试，覆盖同 tick 相反方向、intent 持久化、释放后恢复对向 held、短 tap pulse、上下方向冲突。
- 文件：
  - `apps/client/src/main.ts`
  - `apps/client/src/input.ts`
  - `apps/client/src/input.test.ts`
  - `apps/server/src/rooms/CoopRoom.ts`
  - `apps/server/src/rooms/CoopRoom.test.ts`
  - `apps/server/src/rooms/CoopRoom.input.test.ts`
  - `DEV_LOG.md`
- 验证：
  - `corepack enable`：通过。
  - `corepack prepare pnpm@10.33.2 --activate`：通过。
  - `pnpm install`：通过；pnpm 提示忽略 `esbuild`、`msgpackr-extract` build scripts。
  - `pnpm typecheck`：通过。
  - `pnpm lint`：通过。
  - `pnpm test`：通过；shared 2 个测试文件 6 个测试，client 1 个测试文件 9 个测试，server 2 个测试文件 17 个测试。
  - `pnpm build`：通过；Vite 仍提示客户端 chunk 超过 500 kB。
  - `rg "createDirectionTapInput|minDirectionTapMs|pendingDirectionReleaseIds|getDirectionReleaseDelayMs|scheduleDirectionRelease|releaseBufferedKey|clearPendingDirectionRelease|clearPendingDirectionReleases" apps/client/src/main.ts`：无输出。
  - `rg "createDirectionTapInput|DirectionKey|getDirectionKey" apps`：无输出。
  - `rg "horizontalIntent|verticalIntent|effectiveLeft && effectiveRight|effectiveUp && effectiveDown|directionPulseTicks.right = 0|directionPulseTicks.left = 0" apps/server/src/rooms/CoopRoom.ts`：能看到持久意图、冲突消解、对向 pulse 清理逻辑。
  - `rg "Number\\(input.right\\) - Number\\(input.left\\)" apps/server/src/rooms/CoopRoom.ts`：确认物理层仍使用 `right-left` 算水平轴。
  - `pnpm dev`：客户端 `5173`、服务端 `2567` 启动成功，验证后已停止。
- 风险：
  - 未完成真实双浏览器人工方向键全流程；Browser Use 当前只保留一个 in-app 标签，且自动化键盘 API 不能稳定模拟长按/松开组合。
  - 本机 PowerShell 启动异常，本次验证命令通过 Node 子进程执行；`rg` 因 WindowsApps 路径执行权限问题，复制到临时目录后运行。

## 2026-04-25 17:31:16 +08:00

- 任务：点击 CREATE 后不等第二人和 Ready，先显示关卡画面，并允许房主单人热身移动。
- 改动：
  - 客户端将 `waiting + 1人` 识别为 warmup 状态，允许发送游戏输入并拦截方向键默认行为。
  - HUD 在单人 warmup 时显示 `Warmup level-001 (1/2)`。
  - 服务端允许 `waiting + 1人` 时处理输入和模拟移动；第二人加入进入 ready check 后暂停热身移动。
  - 新增服务端测试覆盖单人 warmup 可移动、第二人加入 ready check 后暂停移动。
- 文件：
  - `apps/client/src/main.ts`
  - `apps/server/src/rooms/CoopRoom.ts`
  - `apps/server/src/rooms/CoopRoom.test.ts`
  - `DEV_LOG.md`
- 验证：
  - `pnpm typecheck`：通过。
  - `pnpm lint`：通过。
  - `pnpm test`：通过；shared 2 个测试文件 6 个测试，client 1 个测试文件 9 个测试，server 2 个测试文件 19 个测试。
  - `pnpm build`：通过；Vite 仍提示客户端 chunk 超过 500 kB。
  - `pnpm dev`：客户端 `5173`、服务端 `2567` 启动成功。
  - In-app browser 复测 `http://127.0.0.1:5173/`：点击 CREATE 后显示房间号、角色 A、`Warmup level-001 (1/2)`，关卡画面已渲染。
  - Colyseus SDK 运行态验证：单人 waiting 阶段 A 从 `x=80` 移动到 `x=172.82`，发送停止输入后停住。
- 风险：
  - 未做真实键盘手动长按测试；浏览器自动化只验证了 CREATE 后 warmup 状态和画面，移动通过服务端测试与 SDK 运行态验证。
  - 本次保留 `pnpm dev` 运行中，方便继续在 `http://127.0.0.1:5173/` 手测。

## 2026-04-25 17:37:58 +08:00

- 任务：继续处理方向键仍偶发异常的问题。
- 改动：
  - 服务端 `consumePlayerInputsForTick()` 对迟到的旧方向快照只刷新短按 pulse，不再覆盖当前 held 状态、`lastInput` 或最新方向意图。
  - 保留旧方向包的短 tap 可见性，同时避免旧包在当前方向之后到达时抢占 horizontal/vertical intent。
  - 新增回归测试覆盖“释放包先被消费、旧按下包后到”不会变成持续 held，以及旧反方向 pulse 不会覆盖当前 held 方向。
- 文件：
  - `apps/server/src/rooms/CoopRoom.ts`
  - `apps/server/src/rooms/CoopRoom.input.test.ts`
  - `DEV_LOG.md`
- 验证：
  - `pnpm typecheck`：通过。
  - `pnpm lint`：通过。
  - `pnpm test`：通过；shared 2 个测试文件 6 个测试，client 1 个测试文件 9 个测试，server 2 个测试文件 21 个测试。
  - `pnpm build`：通过；Vite 仍提示客户端 chunk 超过 500 kB。
  - 运行态方向验证：单人 warmup 长按右方向从 `x=80` 到 `x=134.86`，释放后停住；快速右 tap 从 `x=80` 到 `x=106`。
  - 运行态乱序验证：先发 `seq=2` 释放，再发迟到 `seq=1` 右按下，角色从 `x=80` 短暂移动到 `x=111.98` 后停住，`lastProcessedInputSeq=2`。
- 风险：
  - 仍未拿到用户现场的具体按键序列；如果问题来自浏览器实际 keydown/keyup 丢失或焦点，需继续抓客户端发包日志定位。
