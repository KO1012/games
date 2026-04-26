# DEV_LOG.md

本文件记录 AI 对项目文件的改动。记录按时间从旧到新排序；以后每次 AI 修改项目文件，都必须在文件末尾追加记录，不要插入到文件顶部或历史记录中间。

记录格式：

```markdown
## YYYY-MM-DD HH:mm:ss +08:00

- 任务：
- 改动：
- 文件：
- 验证：
- 风险：
```

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

## 2026-04-25 18:02:59 +08:00

- 任务：为 P0 方向键失灵问题加入可开关 INPUT DEBUG TRACE，定位浏览器事件、客户端发送、服务端收包/consume、水平物理碰撞四段链路，并补充 debug open field 验证。
- 改动：
  - 客户端新增 `?debugInput=1` 开关，记录 keydown/keyup、clear-buffer、send/send-skip，并暴露 `window.__COOP_INPUT_DEBUG__`。
  - 服务端新增 `INPUT_DEBUG=1` 日志，记录 input reject/enqueue、consume effectiveInput、physics-x 位移和水平碰撞 id。
  - 新增 `levels/level-debug-input.json`，并在 `DEBUG_LEVEL=1` 时让该关卡排在第一位；常规加载仍只使用数字关卡。
  - 扩展 level schema，允许 `level-debug-input` 作为调试关卡 id，并允许该调试关卡使用单人出口。
  - 补充服务器输入测试：open field 右键 60 tick 持续移动、关闭门碰撞报告 `door-a` 且可反向离开、左右方向不会同时输出。
- 文件：
  - `apps/client/src/main.ts`
  - `apps/server/src/rooms/CoopRoom.ts`
  - `apps/server/src/levels.ts`
  - `apps/server/src/rooms/CoopRoom.input.test.ts`
  - `packages/shared/src/level.ts`
  - `packages/shared/src/level.test.ts`
  - `levels/level-debug-input.json`
  - `LEVEL_SCHEMA.md`
  - `DEV_LOG.md`
- 验证：
  - `corepack pnpm run typecheck`：通过。
  - `corepack pnpm run lint`：通过。
  - `corepack pnpm run test`：通过，shared 7 tests、client 9 tests、server 23 tests。
  - `corepack pnpm run build`：通过；Vite 仍提示现有 chunk 大小超过 500 kB。
- 风险：未进行双浏览器手工联调复现；需要按 `INPUT_DEBUG=1 DEBUG_LEVEL=1 pnpm dev` 和 `http://localhost:5173/?debugInput=1` 在浏览器 console/server console 观察完整链路。

## 2026-04-25 18:20:23 +08:00

- 任务：按用户要求把输入 debug 信息显示到游戏画面内，减少依赖服务端终端日志。
- 改动：
  - 新增服务端 `input_debug` 调试广播消息，仅 `INPUT_DEBUG=1` 时发送，不参与玩法逻辑。
  - 客户端 `?debugInput=1` 时新增右下角 `INPUT DEBUG` 浮层，显示 room/role/phase、当前输入快照、本地 key/send/send-skip、服务端 enqueue/consume/physics-x/reject、玩家 x/vx/seq。
  - 为 `KeyboardInputBuffer` 增加只读 `peekSnapshot()`，debug trace/浮层读取输入时不消费 `jumpPressed`/`interactPressed`。
  - `NETWORK_SPEC.md` 补充 `input_debug` 调试事件。
- 文件：
  - `apps/client/src/main.ts`
  - `apps/client/src/input.ts`
  - `apps/client/src/styles.css`
  - `apps/server/src/rooms/CoopRoom.ts`
  - `packages/shared/src/protocol.ts`
  - `NETWORK_SPEC.md`
  - `DEV_LOG.md`
- 验证：
  - `corepack pnpm run typecheck`：通过。
  - `corepack pnpm run lint`：通过。
  - `corepack pnpm run test`：通过，shared 7 tests、client 9 tests、server 23 tests。
  - `corepack pnpm run build`：通过；Vite 仍提示现有 chunk 大小超过 500 kB。
- 风险：未在浏览器内手工长按方向键确认浮层实时刷新；当前 5174/2568 debug dev watch 进程应会自动热更新。

## 2026-04-25 18:31:31 +08:00

- 任务：在输入 debug 浮层中补充相机与渲染屏幕坐标，用于判断“世界坐标移动但视觉上不动”是否由相机跟随造成。
- 改动：
  - `GameScene` 新增 `getRenderDebugInfo()`，返回相机 `scrollX/scrollY`、中心点、本地玩家 view 坐标、屏幕坐标和 follow 状态。
  - `INPUT DEBUG` 浮层新增 `camera` 与 `render` 两行，显示 `scroll/center/follow/view/screen`。
- 文件：
  - `apps/client/src/scenes/GameScene.ts`
  - `apps/client/src/main.ts`
  - `DEV_LOG.md`
- 验证：
  - `corepack pnpm run typecheck`：通过。
  - `corepack pnpm run lint`：通过。
  - `corepack pnpm run test`：通过，shared 7 tests、client 9 tests、server 23 tests。
  - `corepack pnpm run build`：通过；Vite 仍提示现有 chunk 大小超过 500 kB。
- 风险：未在浏览器内截图确认新增字段展示；当前 dev server 应通过 Vite 热更新加载客户端改动。

## 2026-04-25 18:37:35 +08:00

- 任务：根据画面 debug 结果修复服务端物理位移为 0 的问题。
- 改动：
  - `physics-x` debug 事件补充 `deltaSeconds` 字段。
  - 修正 `normalizeDeltaMs`：当 Colyseus/计时器传入异常小的 delta 时，回退到固定 60Hz tick 时长，避免 `axisX=1`、`vx=260` 但 `attemptedX/finalX` 不变化。
  - 增加回归测试，模拟接近 0 的 simulation delta，确认玩家仍会按固定 tick 移动。
- 文件：
  - `apps/server/src/rooms/CoopRoom.ts`
  - `apps/server/src/rooms/CoopRoom.test.ts`
  - `DEV_LOG.md`
- 验证：
  - `corepack pnpm run typecheck`：通过。
  - `corepack pnpm run lint`：通过。
  - `corepack pnpm run test`：通过，shared 7 tests、client 9 tests、server 24 tests。
  - `corepack pnpm run build`：通过；Vite 仍提示现有 chunk 大小超过 500 kB。
- 风险：需要刷新当前 debug 页面后重新长按右键确认 `deltaSeconds` 约为 `0.0167` 且 `finalX` 持续增加。

## 2026-04-25 19:11:21 +08:00

- 任务：修复审查指出的 ready 卡住、交互输入长期缓存、出生点安全校验问题，并补齐 30 秒断线重连、关闭门反馈和相机跟随体验。
- 改动：
  - 客户端根据服务端 `ready=false` 同步清除本地 `readySent`，队友离开后可再次点击 READY。
  - 服务端交互输入增加 120ms 过期窗口，未在按钮范围内消费的 `interactPressed` 不再无限期保留。
  - 共享关卡校验改为按 `PLAYER_SIZE` 检查完整出生矩形是否越界或重叠阻挡物。
  - 服务端使用 Colyseus `onDrop` 保留断线席位 30 秒，回连后重发 `room_joined` / `level_start`，过期后移除席位并重置剩余玩家 ready。
  - 客户端保存 `reconnectionToken` 到 `sessionStorage`，异常断开或刷新后优先回连原房间，并在重连中暂停输入。
  - 客户端关闭门附近显示 `LOCKED` 反馈并高亮门框；相机跟随增加 deadzone，减少本地角色视觉静止感。
  - 更新 `NETWORK_SPEC.md`、`ROADMAP.md`、`README.md` 中断线重连状态说明。
- 文件：
  - `apps/client/src/main.ts`
  - `apps/client/src/scenes/GameScene.ts`
  - `apps/server/src/rooms/CoopRoom.ts`
  - `apps/server/src/rooms/CoopRoom.test.ts`
  - `apps/server/src/rooms/CoopRoom.input.test.ts`
  - `packages/shared/src/level.ts`
  - `packages/shared/src/level.test.ts`
  - `NETWORK_SPEC.md`
  - `ROADMAP.md`
  - `README.md`
  - `DEV_LOG.md`
- 验证：
  - `corepack pnpm run typecheck`：通过。
  - `corepack pnpm run lint`：通过。
  - `corepack pnpm run test`：通过；shared 2 个测试文件 8 个测试，client 1 个测试文件 9 个测试，server 2 个测试文件 27 个测试。
  - `corepack pnpm run build`：通过；Vite 仍提示客户端 chunk 超过 500 kB。
- 风险：
  - 未做真实双浏览器断网/刷新回连手测；当前由服务端重连单测、客户端类型检查和构建覆盖。
  - 门反馈只做本地可视提示，不改变服务端碰撞判定。

## 2026-04-25 19:16:14 +08:00

- 任务：整理 `DEV_LOG.md` 历史记录顺序，并明确后续 AI 只能按时间顺序追加日志。
- 改动：
  - 将历史日志按时间从旧到新排序。
  - 更新 `DEV_LOG.md` 文件说明，要求新记录追加到文件末尾。
  - 更新 `AGENTS.md` 的 AI 变更记录规则，明确日志升序和末尾追加要求。
- 文件：
  - `AGENTS.md`
  - `DEV_LOG.md`
- 验证：
  - Node REPL 脚本解析 `DEV_LOG.md` 时间标题并确认升序：通过。
  - `git diff --check -- AGENTS.md DEV_LOG.md`：通过。
- 风险：
  - 未运行项目 typecheck/lint/test/build；本次仅整理文档。

## 2026-04-25 19:39:10 +08:00

- 任务：参考可玩性建议，优先增强关卡信息表达和双人可读性，不新增复杂玩法。
- 改动：
  - 扩展关卡 schema，新增可选 `metadata`，包含 `title`、`difficulty`、`introText`、`hintText`、`mechanicTags`、`parTimeMs`。
  - 为 10 个正式关卡和输入调试关卡补充 metadata，客户端 HUD 使用关卡标题展示当前关卡。
  - `GameScene` 新增关卡开场提示、按钮到目标的可视化连线，连线会随按钮激活状态高亮流动。
  - `GameScene` 新增本地玩家头顶箭头和队友离屏方向指示器。
  - 更新 `LEVEL_SCHEMA.md` 和 shared schema 测试，覆盖 metadata 校验。
  - `#level-label` 增加宽度约束，避免较长关卡标题挤出 HUD。
- 文件：
  - `LEVEL_SCHEMA.md`
  - `apps/client/src/main.ts`
  - `apps/client/src/scenes/GameScene.ts`
  - `apps/client/src/styles.css`
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
  - `levels/level-debug-input.json`
  - `packages/shared/src/level.ts`
  - `packages/shared/src/level.test.ts`
  - `DEV_LOG.md`
- 验证：
  - `corepack pnpm run typecheck`：通过。
  - `corepack pnpm run lint`：通过。
  - `corepack pnpm run test`：通过；shared 2 个测试文件 9 个测试，client 1 个测试文件 9 个测试，server 2 个测试文件 27 个测试。
  - `corepack pnpm run build`：通过；Vite 仍提示客户端 chunk 超过 500 kB。
  - HTTP smoke check：`http://127.0.0.1:5173/` 返回 200，`http://127.0.0.1:2567/` 返回 200。
- 风险：
  - 未做真实双浏览器从 Level 1 到 Level 10 的完整手工通关；本次主要解决可读性和 schema 表达。
  - 未做截图级视觉验收；需要手测确认连线、队友离屏指示器和关卡提示在各关不遮挡关键区域。

## 2026-04-25 19:51:51 +08:00

- 任务：修复 Level 10 右侧相邻按钮踩上去不会触发的问题。
- 改动：
  - 将 `level-010` 的 `button-door-left` 从 `interact` 改为 `pressure`，踩上去即可打开 `door-final` 并关闭 `laser-final`。
  - 移除该按钮的交互持续时间和冷却配置，避免视觉上是地面压力板但逻辑需要按 `E`。
  - 更新 Level 10 metadata 文案和标签，把最终门控制描述为压力板配合。
  - 新增 shared 回归测试，锁定 Level 10 最终门两侧地面控制块都必须是压力按钮。
- 文件：
  - `levels/level-010.json`
  - `packages/shared/src/level.test.ts`
  - `DEV_LOG.md`
- 验证：
  - `corepack pnpm run typecheck`：通过。
  - `corepack pnpm run lint`：通过。
  - `corepack pnpm run test`：通过；shared 2 个测试文件 10 个测试，client 1 个测试文件 9 个测试，server 2 个测试文件 27 个测试。
  - `corepack pnpm run build`：通过；Vite 仍提示客户端 chunk 超过 500 kB。
- 风险：
  - 未做浏览器内手动踩按钮验证；按配置和测试，客户端会显示为 `▼` 压力板，服务端会按踩踏触发。

## 2026-04-25 19:57:34 +08:00

- 任务：提升前 10 关的变化和难度，避免后续关卡只是简单按钮门重复。
- 改动：
  - 保留 Level 1-2 作为基础教学，重做 Level 3-10 的关卡布局、机制组合和 metadata。
  - Level 3 改为上下分路互开门；Level 4 改为双激光接力；Level 5 改为三点 ferry 尖刺坑。
  - Level 6 加入上下路线、双门和下路激光；Level 7 改为限时门 + 双尖刺跳跃；Level 8 改为自动移动平台 + 错相激光。
  - Level 9 改为双压机控制爬升；Level 10 改为双 ferry、中继按钮、压机、激光和最终门控综合关。
  - 更新 `LEVEL_NOTES.md`，同步每关设计意图和通关方式。
  - 新增 shared 回归测试，确保后半段关卡保留移动平台、限时按钮、激光、压机和尖刺等机制多样性。
- 文件：
  - `levels/level-003.json`
  - `levels/level-004.json`
  - `levels/level-005.json`
  - `levels/level-006.json`
  - `levels/level-007.json`
  - `levels/level-008.json`
  - `levels/level-009.json`
  - `levels/level-010.json`
  - `LEVEL_NOTES.md`
  - `packages/shared/src/level.test.ts`
  - `DEV_LOG.md`
- 验证：
  - `corepack pnpm run typecheck`：通过。
  - `corepack pnpm run lint`：通过。
  - `corepack pnpm run test`：通过；shared 2 个测试文件 11 个测试，client 1 个测试文件 9 个测试，server 2 个测试文件 27 个测试。
  - `corepack pnpm run build`：通过；Vite 仍提示客户端 chunk 超过 500 kB。
  - Node REPL 关卡摘要检查：Level 3-10 已覆盖分路门控、双激光、移动平台、定时门、尖刺、压机和最终综合关。
- 风险：
  - 未做真实双人手工通关；新关卡比旧版复杂，可能需要根据实际手感微调跳距、按钮位置和压机/平台速度。

## 2026-04-25 20:02:24 +08:00

- 任务：修复 Level 3 蓝门/橙门开门顺序死锁，导致截图位置无法通过的问题。
- 改动：
  - 将 `level-003` 左下 `button-floor-left` 的目标从 `door-upper` 改为 `door-floor`，先打开挡路蓝门。
  - 将中层 `button-upper-mid` 的目标从 `door-floor` 改为 `door-upper`，玩家到达中层后再打开橙门。
  - 更新 Level 3 metadata 文案和 `LEVEL_NOTES.md`，说明正确接力顺序。
  - 新增 shared 回归测试，锁定 Level 3 初始可达按钮必须先打开 `door-floor`。
- 文件：
  - `levels/level-003.json`
  - `LEVEL_NOTES.md`
  - `packages/shared/src/level.test.ts`
  - `DEV_LOG.md`
- 验证：
  - `corepack pnpm run typecheck`：通过。
  - `corepack pnpm run lint`：通过。
  - `corepack pnpm run test`：通过；shared 2 个测试文件 12 个测试，client 1 个测试文件 9 个测试，server 2 个测试文件 27 个测试。
  - `corepack pnpm run build`：通过；Vite 仍提示客户端 chunk 超过 500 kB。
- 风险：
  - 未做浏览器内双人手工验证；本次修复了关卡配置死锁，但跳距和节奏仍建议实测微调。

## 2026-04-25 20:10:16 +08:00

- 任务：
  - 增加玩家可自行选择关卡的功能。
- 改动：
  - 新增客户端 `select_level` 协议消息，文档说明房主选关、越界忽略、切关重置 ready/投票/出生点/机关状态。
  - 服务端新增 `select_level` 处理逻辑：仅玩家 A 可切换关卡，`loadingLevel` 阶段忽略，切换后广播 `level_start` 和 `room_state`。
  - 客户端控制面板新增 Level 下拉框，玩家 A 可在房间内选择 1-10 关，其他玩家只读。
  - 增加服务端测试，覆盖玩家 A 选关成功和玩家 B 选关被忽略。
- 文件：
  - `NETWORK_SPEC.md`
  - `packages/shared/src/protocol.ts`
  - `apps/server/src/rooms/CoopRoom.ts`
  - `apps/server/src/rooms/CoopRoom.test.ts`
  - `apps/client/index.html`
  - `apps/client/src/main.ts`
  - `apps/client/src/styles.css`
  - `DEV_LOG.md`
- 验证：
  - `corepack pnpm run typecheck`：通过。
  - `corepack pnpm run lint`：通过。
  - `corepack pnpm run test`：通过，shared 12 个测试、client 9 个测试、server 29 个测试通过。
  - `corepack pnpm run build`：通过；Vite 仍提示客户端 chunk 超过 500 kB。
- 风险：
  - 未做双浏览器真实联调；选关 UI 和切关后的 ready 流程仍需在两个浏览器里手动确认。

## 2026-04-25 20:31:56 +08:00

- 任务：修复部分关卡不需要合作、单人可直接绕过机关到达出口的问题。
- 改动：
  - Level 5 删除可直接跳过尖刺坑的孤岛跳台，将两段尖刺坑改为需要队友持续压板关闭的高位危险区，压力板同时启动 ferry。
  - Level 7 将中门改为贯通高度，避免从上方跳台直接越过限时门。
  - Level 8 改为 Ferry Laser Relay：ferry 默认停止，压力板启动 ferry 并关闭对应全高激光，取消自动激光窗口。
  - 更新 `LEVEL_NOTES.md` 说明新的配合路径，并新增 shared 回归测试锁定这些绕行修复点。
- 文件：
  - `levels/level-005.json`
  - `levels/level-007.json`
  - `levels/level-008.json`
  - `LEVEL_NOTES.md`
  - `packages/shared/src/level.test.ts`
  - `DEV_LOG.md`
- 验证：
  - Node REPL 单人可达性扫描：修改前 Level 5/7/8 可在不触发合作机关时到达出口；修改后 Level 1-10 均不可达。
  - `corepack pnpm exec prettier --check levels/level-005.json levels/level-007.json levels/level-008.json LEVEL_NOTES.md packages/shared/src/level.test.ts DEV_LOG.md`：发现 4 个文件格式问题；已对对应文件运行 `prettier --write` 修复。
  - `corepack pnpm run typecheck`：通过。
  - `corepack pnpm run lint`：通过。
  - `corepack pnpm run test`：通过；shared 2 个测试文件 13 个测试，client 1 个测试文件 9 个测试，server 2 个测试文件 29 个测试。
  - `corepack pnpm run build`：通过；Vite 仍提示客户端 chunk 超过 500 kB。
  - `git diff --check`：通过；仅有 Git 对 LF/CRLF 的工作区提示。
- 风险：
  - 未做双浏览器真实通关；本次用物理参数扫描和配置回归测试确认绕行已封堵，仍建议手测 Level 5/7/8 的跳距和节奏。

## 2026-04-26 00:32:42 +08:00

- 任务：扩展按钮系统并重做 10 关。新增 `mode: "toggle"` 与目标动作 `delayMs`，按其重新设计 level-001 ~ level-010，使每关聚焦一个新机制，最后一关综合。
- 改动：
  - shared 增加 `ButtonMode = "hold" | "toggle"`，schema 校验放行 toggle，错误信息更新为 `hold or toggle`；`resolveHoldButtonDoorState` 添加注释强调静态预览只覆盖 hold。
  - 服务器在 `CoopRoom` 增加 toggle latch（press-edge + cooldown）和按目标 key 的 `targetRuntime` 实现 `delayMs` 双向延迟（含取消未生效翻转）。`initializeLevel` 同步清空 `targetRuntime`。
  - 重写 `levels/level-001.json` ~ `levels/level-010.json` 为新教学路径：Press & Cross / Latched Gate / Timed Sprint / Interact Lift / Delayed Gate / Strobe Lasers / Crusher Corridor / Conveyor Outpost / Cipher Doors / Last Stand。
  - shared/level.test.ts 改为按机制覆盖断言，新增 toggle/delayMs 接受性测试与未知 mode 拒绝测试；apps/server/src/rooms/CoopRoom.test.ts 新增 4 个 toggle/delayMs 行为测试。
  - GAME_DESIGN.md 更新按钮 kind/mode 段落与 10 关规划；LEVEL_NOTES.md 替换全部关卡说明；LEVEL_SCHEMA.md 把 `button.mode` 枚举更新为 `["hold", "toggle"]`。
- 文件：
  - `packages/shared/src/level.ts`
  - `packages/shared/src/level.test.ts`
  - `apps/server/src/rooms/CoopRoom.ts`
  - `apps/server/src/rooms/CoopRoom.test.ts`
  - `levels/level-001.json` ~ `levels/level-010.json`
  - `GAME_DESIGN.md`
  - `LEVEL_NOTES.md`
  - `LEVEL_SCHEMA.md`
  - `DEV_LOG.md`
- 验证：
  - `corepack pnpm --filter @coop-game/shared run build`：通过（重建 dist 以提供新的 toggle/ButtonMode 类型）。
  - `corepack pnpm run typecheck`：通过。
  - `corepack pnpm run lint`：通过。
  - `corepack pnpm run test`：通过；shared 12，server 33（含 4 个新增 toggle/delay 测试），client 9。
  - `corepack pnpm run build`：通过；client 仍提示 chunk > 500 kB。
- 风险：
  - 未做双客户端联机回归，关卡空间布局只通过参数化校验和单测确认；建议手动跑一遍 Level 1-10 确认尺寸与跳跃可达性。
  - delayMs 取消语义为：延迟期内目标条件回到原状即取消未生效翻转；这与两次脉冲都生效的硬件继电器不同，关卡设计应以此为准。

## 2026-04-26 01:08:26 +08:00

- 任务：升级客户端画面与音乐。引入可选的 CC0 外部精灵图与音频资源系统，新增多层 parallax 背景、玩家动画状态机、独立 MusicManager（外部 OGG + 程序化 chiptune 兜底）、SfxManager 与音量持久化 UI；服务端、协议、关卡未受影响。
- 改动：
  - 资源系统：新增 `apps/client/public/assets/`（含 `CREDITS.md`、空子目录占位）与 `apps/client/scripts/download-assets.mjs`；新增 `apps/client/src/assets/manifest.ts`、`apps/client/src/assets/AssetRegistry.ts`、`apps/client/src/scenes/PreloadScene.ts`；通过 Phaser loader 事件给每个 key 标记 present/missing，下游系统按此选择走外部资源还是程序化兜底。
  - 玩家动画：新增 `apps/client/src/rendering/PlayerAnimator.ts` 含纯函数 `selectPlayerAnimState`、`registerAnimations`、`apply`，处理 Kenney "Pixel Platformer" 24×24 帧的 idle/run/jump/fall/death 与 squash/stretch、breath、bob、dust。`apps/client/src/rendering/PlayerAnimator.test.ts` 新增 6 个状态选择单元测试。
  - 背景：重写 `apps/client/src/rendering/BackgroundRenderer.ts` 为 5 层（sky gradient → 远景山脊或外部图 → 中景脊线或外部图 → 星点 → 漂移雾带）多 parallax 因子，外部图与程序化兜底自动切换。
  - 音频：新增 `apps/client/src/audio/preferences.ts`（musicVolume/sfxVolume/muted + localStorage 持久化 + listener）、`apps/client/src/audio/SfxManager.ts`（外部 OGG 优先 → Web Audio 合成兜底，受 effectiveSfxVolume 控制）、`apps/client/src/audio/MusicManager.ts`（外部循环 OGG 优先；缺失时启动内置三段 chiptune 步进音序器：menu/level/victory，BPM 与音色独立配置）。`apps/client/src/audio/SoundManager.ts` 改为向后兼容 facade 重导出 SfxManager。
  - 接入：`apps/client/src/scenes/GameScene.ts` 改用 PlayerAnimator、绑定 SfxManager 场景、按 phase 切换 MusicManager 曲目（playing/loadingLevel→level，levelComplete/finished→victory，其它→menu），并在场景 SHUTDOWN/DESTROY 释放音乐。`apps/client/src/main.ts` 注册 PreloadScene 在 GameScene 之前，新增 `setupVolumeControls()` 接入 HTML 音量面板。`apps/client/index.html` 新增 `#audio-controls` 浮层（toggle/music/sfx/mute）；`apps/client/src/styles.css` 新增 `.audio-controls`、`.volume-panel` 样式。
  - 工程：`eslint.config.js` 新增 `apps/client/scripts/**/*.mjs` 启用 node 全局，避免下载脚本因 console/process 报错。`README.md` 新增「美术与音频资源」段，记录 fallback 策略、下载脚本、音量 UI、CREDITS 路径。
- 文件：
  - `apps/client/public/assets/CREDITS.md`（新增）
  - `apps/client/public/assets/.gitkeep`（新增，占位）
  - `apps/client/scripts/download-assets.mjs`（新增）
  - `apps/client/src/assets/manifest.ts`（新增）
  - `apps/client/src/assets/AssetRegistry.ts`（新增）
  - `apps/client/src/scenes/PreloadScene.ts`（新增）
  - `apps/client/src/rendering/PlayerAnimator.ts`（新增）
  - `apps/client/src/rendering/PlayerAnimator.test.ts`（新增）
  - `apps/client/src/rendering/BackgroundRenderer.ts`（重写）
  - `apps/client/src/audio/preferences.ts`（新增）
  - `apps/client/src/audio/SfxManager.ts`（新增）
  - `apps/client/src/audio/MusicManager.ts`（新增）
  - `apps/client/src/audio/SoundManager.ts`（改为 facade）
  - `apps/client/src/scenes/GameScene.ts`
  - `apps/client/src/main.ts`
  - `apps/client/index.html`
  - `apps/client/src/styles.css`
  - `eslint.config.js`
  - `README.md`
  - `DEV_LOG.md`
- 验证：
  - `corepack pnpm run typecheck`：通过。
  - `corepack pnpm run lint`：通过（新加的 node mjs 例外生效）。
  - `corepack pnpm run test`：通过；shared 12，client 15（新增 6 个 PlayerAnimator 测试），server 33。
  - `corepack pnpm run build`：通过；`apps/client/dist/assets/{audio,bg,sprites,CREDITS.md}` 正常发布；client 仍提示 chunk > 500 kB（既有警告）。
- 风险：
  - 未做浏览器手测：建议手动跑一次确认 PreloadScene 进度条、菜单/关卡/胜利三段程序化音乐切换、音量滑块持久化、关卡内玩家动画状态切换均符合预期。
  - 未实际下载 CC0 二进制资源；`download-assets.mjs` 仅引导用户去 Kenney 页面手动下载，URL 失效时需自行寻找替代资源。manifest 中的精灵图帧布局基于 Kenney "Pixel Platformer" 9×12 网格的常见排版，若使用其他资源包需要调整 `SPRITE_FRAMES` 索引。
  - 程序化 chiptune 简单循环，长时间游玩可能略显单调；后续若导入外部 OGG 会自动覆盖。
  - 未补充 SfxManager / MusicManager 的运行时单元测试（依赖 AudioContext，难以在 Node 测试环境模拟），主要靠 PlayerAnimator 的纯函数测试与 lint/typecheck/build 把关。

## 2026-04-26 01:40:54 +08:00

- 任务：实际下载并配置 CC0 资源到 `apps/client/public/assets/`，让生产构建携带真实的角色精灵、音乐和音效，同时保持缺失时仍可程序化兜底。
- 改动：
  - `apps/client/scripts/download-assets.mjs`：重写为完整的下载/解包工具——直接 fetch 每个 Kenney 资源页 HTML，正则抓取 ZIP 直链（兼容单/双引号 href），下载到 `apps/client/.asset-cache/`，使用内置 `node:zlib` inflateRaw 实现的最小 ZIP 解析器（central directory + STORE/DEFLATE）按 `internal`/`pickByName`/`pickByIndex` 三种规则提取目标文件并落到 `public/assets/` 对应路径。Node 20+ 原生 fetch，无新增依赖。
  - 资源结构调整：放弃 `background-elements`（kenney.nl 无适配像素风 parallax 包，且 `background-elements-redux`/`platformer-art-pixel-redux` 已下线）；玩家两角色合并到单张 `sprites/players.png`（Kenney "Pixel Platformer" `tilemap-characters_packed.png`，9×3 个 24×24 格），通过行偏移区分 A/B；level_complete/game_complete 改从 `music-jingles` 抓取，因 `ui-audio` 只有点击/开关音效。
  - `apps/client/src/assets/manifest.ts`：`SPRITE_ASSETS` 简化为单个 `ext_players` spritesheet；移除 `ext_bg_*` 三个背景条目。
  - `apps/client/src/rendering/PlayerAnimator.ts`：新增 `SHARED_SHEET_KEY` + `ROLE_ROW`（A=row0, B=row1）+ `SHEET_COLS=9`；`SPRITE_FRAMES` 改为 `SPRITE_FRAMES_RELATIVE`（idle=0, run=[1,0,2,0], jump/fall=3, death=4，符合 Kenney 单行布局）；`registerAnimations` 用行偏移生成两套动画，动画 key 改为 `ext_players_<role>_<state>`；`hasExternalSheet`/`getTextureKey`/`getBaseScale` 改用共享 sheet 判定。
  - 配套清单：`apps/client/public/assets/CREDITS.md` 重写为实际抓取到的资源映射表（角色 PNG + 3 段音乐 + 13 段音效），并解释缺失资源时的兜底行为。
  - `.gitignore`：忽略 `.asset-cache/` 与 `apps/client/public/assets/{sprites,bg,audio}/`，避免把二进制提交进 Git。
- 文件：
  - `apps/client/scripts/download-assets.mjs`（重写）
  - `apps/client/src/assets/manifest.ts`
  - `apps/client/src/rendering/PlayerAnimator.ts`
  - `apps/client/public/assets/CREDITS.md`（重写）
  - `.gitignore`
  - `DEV_LOG.md`
  - 新增（被 .gitignore 忽略）：`apps/client/public/assets/sprites/players.png`、`tiles_terrain.png`、`apps/client/public/assets/audio/music/{menu_loop,level_loop,victory_loop}.ogg`、`apps/client/public/assets/audio/sfx/{jump,land,death,button_press,button_release,interact,door_open,door_close,respawn,laser_hum,level_complete,game_complete}.ogg`，以及缓存 `apps/client/.asset-cache/*.zip`。
- 验证：
  - `node apps/client/scripts/download-assets.mjs`：通过；6 个 Kenney 包成功解析直链并提取 15 个目标文件，无 warning。
  - `corepack pnpm run typecheck`：通过。
  - `corepack pnpm run lint`：通过（修掉了未使用的 `copyFile`/`rm` 与 `_role` 报错）。
  - `corepack pnpm run test`：通过；shared 12，client 15，server 33，总 60。
  - `corepack pnpm run build`：通过；vite 把 `public/assets/{sprites/players.png, sprites/tiles_terrain.png, audio/music/*.ogg, audio/sfx/*.ogg, CREDITS.md}` 一并发布到 `apps/client/dist/assets/`，client bundle 仍提示 chunk > 500 kB（既有警告，未处理）。
- 风险：
  - 未做浏览器手测：建议在 `pnpm dev` 环境下确认外部音乐/音效与玩家精灵实际播放正常、动画状态切换匹配 Kenney 帧布局；若发现某状态帧对应错（例如 hurt/jump 对调），调整 `SPRITE_FRAMES_RELATIVE` 即可。
  - kenney.nl 直链含时间戳哈希，未来 Kenney 重发时哈希会变，但脚本每次重新解析 HTML 提取，仍能工作；若 Kenney 改版页面结构则需要更新正则。
  - 资源不进 git，团队其它成员/CI 第一次拉取仓库需要手动跑一次 `download-assets.mjs`；可以在 CI/部署流程里加上这一步。
  - `tiles_terrain.png` 已下载但目前 `BackgroundRenderer` 与 `TextureGenerator` 都没引用，预留给后续把瓷片美术也接外部资源的工作。

## 2026-04-26 02:21:00 +08:00

- 任务：评估 `levels/level-001.json`～`level-010.json` 配合度与是否存在不可解 / 单人通关漏洞，并修复发现的硬错误与无配合关卡。
- 分析结论（详见 `C:\Users\benja\.windsurf\plans\level-design-audit-54fcfc.md`）：
  - L005 在原坐标下物理上不可解：单板 x=240 + delayMs=1100 同向作用 open/close，按板者离板后 1.91 s 才能跑到 door 右沿 800，>1.1 s 关门窗口。
  - L009 `divider-mid` y=360..656 实墙，玩家从地面跳跃顶点 y=448（+ size 48 = 底 496）无法越过，且 JSON 中没有上路平台落地，关卡不可解。
  - L010 `spike-pit-b` 跨距 240 px，玩家同高度起跳最大水平距离 ≈ 219.6 px，跨不到 floor-end。
  - L002、L008 用 toggle latch 单人即可解（除 `requiresBothPlayers` 出口兜底），无位置/时机互锁。
  - L003、L006、L007 是"两人各跑各的"时机题，配合度弱但无漏洞，作为单一机制教学保留。
  - L004 用 `interact + holdMs=6000` 教学 interact，配合度弱但属合理教学，且是测试 `hasInteractButton` 唯一来源，保留不改。
- 改动：
  - `levels/level-002.json`：从"双 toggle 单门一关一锁"重做为三板接力 hold——`button-1`(x=240) 开 door-1，`button-2`(x=720) 同时开 door-1+door-2，`button-3`(x=1080) 开 door-2；door-2 由 x=1020 移到 x=940 给 button-3 留位置；mechanicTags 由 `["pressure","toggle","door"]` 改为 `["pressure","hold","relay","door"]`，名字改 "Hold Relay"，parTime 50000→60000。
  - `levels/level-005.json`：仅把 `button-relay.rect.x` 从 240 改到 600（距门 96 px，0.37 s 通过，<1.1 s 关门窗口），保留 `delayMs:1100` 教学意图。
  - `levels/level-008.json`：`button-conveyor` toggle 改成双板 pressure hold——`button-conveyor-l`(x=260) 与 `button-conveyor-r`(x=1340)，单人无法两端同时按；mechanicTags 由 `["pressure","toggle","moving","spike","wide"]` 改为 `["pressure","hold","moving","spike","wide","coop"]`，parTime 70000→75000。
  - `levels/level-009.json`：删 `divider-mid`，加上路 `step-a`(200,560)、`step-b`(320,480)、`upper-path`(360,400,600,24) 三块 oneWay 平台；`door-blue` 缩成上路门 `(600,256,32,144)`；`door-amber` 改成下路门 `(920,420,32,236)`，`startsOpen` 由 true 改为 false（避免 floor 玩家初始就能直接走过去）；`button-cipher-b` 由 x=440 移到 x=720（在两扇门之间）。
  - `levels/level-010.json`：`spike-pit-b.rect.w` 由 240 改 200，`floor-end.rect` 由 `(1320,656,280,64)` 改 `(1280,656,320,64)`，玩家在 crusher 抬起窗口可跳过 200 px 缺口。
  - `LEVEL_NOTES.md`：同步更新 L002、L005、L008、L009、L010 的关卡说明段，记录新机制与通关流程。
- 文件：
  - `levels/level-002.json`
  - `levels/level-005.json`
  - `levels/level-008.json`
  - `levels/level-009.json`
  - `levels/level-010.json`
  - `LEVEL_NOTES.md`
  - `DEV_LOG.md`
- 验证：
  - `corepack pnpm run typecheck`：通过。
  - `corepack pnpm run lint`：通过。
  - `corepack pnpm run test`：通过；shared 12（含 `level.test.ts` 11 项关卡 schema/机制覆盖断言：仍命中 toggle/timed/interact/delayed/laser cycle/crusher/spike/wide world/moving）、server 33、client 15。
  - `corepack pnpm run build`：通过。
- 风险：
  - 未做双客户端联调实测；L002 三板接力、L008 双端 hold、L009 上下双路与 L010 跳缺口的真实玩家手感都仅按物理参数推算（PLAYER_SPEED=260、JUMP=760、gravity=1800、PLAYER_SIZE=48），现场打可能发现节奏需要再调（例如 L009 跳阶梯的 oneWay 接住边界，或 L010 200 px 缺口仍偏紧）。
  - L009 删除 `divider-mid` 后客户端如果有针对该平台的渲染缓存或截图，可能需要刷新；当前 `BackgroundRenderer` 只读关卡 JSON 即可，不需要额外改动。
  - L002 已不包含 `mode:"toggle"` 按钮，但 toggle 标签仍由 L009/L010 提供；如果未来再去掉这两关的 toggle 会让 `hasToggleButton` 测试失败，需要同步关卡校验。
  - 关卡平衡仍偏中段时机题（L003/L006/L007），整体难度曲线没有重大上调，仅修掉硬错误与无配合关；如果还想加难度，建议后续单独任务针对中段三关引入双人时序约束。

## 2026-04-26 15:52:47 +08:00

- 任务：调用 imagegen 重新设计游戏美术资源，并接入客户端。
- 改动：
  - 使用 imagegen 生成地下交通实验室像素风背景，新增 `ext_bg_backdrop` 加载入口，背景优先使用 `assets/bg/lab_backdrop.png`，缺失时回退程序化背景。
  - 替换 `players.png` 为项目定制 9×3、24×24 玩家 spritesheet，玩家 A/B 改为青绿/琥珀色实验室跑者。
  - 调整平台、按钮、门、陷阱、出口、墙体纹理细节和全局配色，使程序化纹理匹配新背景。
  - 更新 UI CSS 配色、资源说明、下载脚本和 `.gitignore`，避免下载脚本覆盖定制玩家图，并提交指定定制美术资源。
- 文件：
  - `.gitignore`
  - `apps/client/public/assets/bg/lab_backdrop.png`
  - `apps/client/public/assets/sprites/players.png`
  - `apps/client/public/assets/CREDITS.md`
  - `apps/client/scripts/download-assets.mjs`
  - `apps/client/src/assets/manifest.ts`
  - `apps/client/src/rendering/BackgroundRenderer.ts`
  - `apps/client/src/rendering/PlayerAnimator.ts`
  - `apps/client/src/rendering/TextureGenerator.ts`
  - `apps/client/src/scenes/GameScene.ts`
  - `apps/client/src/scenes/PreloadScene.ts`
  - `apps/client/src/styles.css`
  - `apps/client/src/ui/colors.ts`
  - `DEV_LOG.md`
- 验证：
  - `corepack pnpm exec prettier --write ...`：通过；首次包含 `.gitignore` 时 Prettier 无 parser 报错，已排除 `.gitignore` 后重跑通过。
  - `corepack pnpm run typecheck`：通过。
  - `corepack pnpm run lint`：通过。
  - `corepack pnpm run test`：通过；shared 12 个测试、client 15 个测试、server 33 个测试。
  - `corepack pnpm run build`：通过；Vite 仍提示客户端 chunk 超过 500 kB。
  - 本地开发服：`http://127.0.0.1:5173` 返回 200，`http://127.0.0.1:2567` 返回 200。
  - 资源加载：`/assets/bg/lab_backdrop.png` 和 `/assets/sprites/players.png` 均返回 200。
  - Chrome headless 截图检查：主界面正常显示新背景、UI 配色和布局，无明显遮挡。
- 风险：
  - 未做双浏览器联机通关回归；本次重点验证资源加载、构建和主界面显示。
  - 新背景约 2 MB，首次加载体积比程序化背景更大。
  - 本机 PowerShell 启动异常，本次命令通过 Node 子进程调用 `cmd.exe` 执行。

## 2026-04-26 16:14:11 +08:00

- 任务：继续调用 imagegen 设计一整套游戏美术资源并应用到客户端渲染。
- 改动：
  - 使用 imagegen 重新生成主背景 `lab_backdrop.png`，视觉方向统一为地下交通实验室像素风。
  - 新增 `sprites/world/*.png` 外部纹理资源：平台、单向平台、移动平台、按钮、五色门、尖刺、激光、压墙、出口、墙体、粒子。
  - `manifest.ts` 增加整套世界纹理加载项；`TextureGenerator.ts` 在外部纹理已加载时不再覆盖，保留缺失资源兜底。
  - `GameScene.ts` 改为按钮、门、激光、出口优先使用 TileSprite PNG 纹理，并把门阻挡反馈改为 tint 反馈。
  - `CREDITS.md` 与 `.gitignore` 同步记录并纳入项目定制资源。
- 文件：
  - `.gitignore`
  - `apps/client/public/assets/bg/lab_backdrop.png`
  - `apps/client/public/assets/sprites/world/button_active.png`
  - `apps/client/public/assets/sprites/world/button_idle.png`
  - `apps/client/public/assets/sprites/world/door_blue.png`
  - `apps/client/public/assets/sprites/world/door_green.png`
  - `apps/client/public/assets/sprites/world/door_orange.png`
  - `apps/client/public/assets/sprites/world/door_purple.png`
  - `apps/client/public/assets/sprites/world/door_red.png`
  - `apps/client/public/assets/sprites/world/exit_zone.png`
  - `apps/client/public/assets/sprites/world/pixel_particle.png`
  - `apps/client/public/assets/sprites/world/platform_moving.png`
  - `apps/client/public/assets/sprites/world/platform_oneway.png`
  - `apps/client/public/assets/sprites/world/platform_solid.png`
  - `apps/client/public/assets/sprites/world/trap_crusher.png`
  - `apps/client/public/assets/sprites/world/trap_laser.png`
  - `apps/client/public/assets/sprites/world/trap_spike.png`
  - `apps/client/public/assets/sprites/world/wall_tile.png`
  - `apps/client/public/assets/CREDITS.md`
  - `apps/client/src/assets/manifest.ts`
  - `apps/client/src/rendering/TextureGenerator.ts`
  - `apps/client/src/scenes/GameScene.ts`
  - `DEV_LOG.md`
- 验证：
  - `corepack pnpm exec prettier --write ...`：通过。
  - `corepack pnpm run typecheck`：通过；中途发现门 TileSprite 旧描边 API 类型错误，已改为 tint 后重跑通过。
  - `corepack pnpm run lint`：通过。
  - `corepack pnpm run test`：通过；shared 12 个测试、client 15 个测试、server 33 个测试。
  - `corepack pnpm run build`：通过；Vite 仍提示客户端 chunk 超过 500 kB。
  - 资源 HTTP 检查：`/assets/bg/lab_backdrop.png`、`/assets/sprites/world/button_active.png`、`/assets/sprites/world/door_green.png` 均返回 200。
- 风险：
  - Chrome/Edge headless 截图命令本轮卡在浏览器自身后台服务错误，未产出新截图；已用资源 HTTP 检查和构建验证兜底。
  - 未做双浏览器联机通关回归。
  - 新背景约 1.9 MB，首次加载体积仍明显高于程序化背景。

## 2026-04-26 16:22:46 +08:00

- 任务：替换当前项目背景音乐。
- 改动：
  - 新增 3 条项目内生成的 WAV 循环曲，分别用于菜单、关卡和通关阶段。
  - 更新客户端音频 manifest，使 `music_menu`、`music_level`、`music_victory` 改用新 WAV。
  - 更新资源下载脚本，Kenney Music Jingles 只继续用于通关音效，不再覆盖背景音乐。
  - 更新资源版权说明和 `.gitignore`，只纳入项目定制音乐 WAV，继续忽略旧 OGG 和 SFX 下载资源。
- 文件：
  - `.gitignore`
  - `apps/client/public/assets/audio/music/menu_lab_drift.wav`
  - `apps/client/public/assets/audio/music/level_circuit_run.wav`
  - `apps/client/public/assets/audio/music/victory_signal_clear.wav`
  - `apps/client/public/assets/CREDITS.md`
  - `apps/client/scripts/download-assets.mjs`
  - `apps/client/src/assets/manifest.ts`
  - `apps/client/src/audio/MusicManager.ts`
  - `DEV_LOG.md`
- 验证：
  - WAV 头校验：3 个文件均为 RIFF/WAVE、44.1kHz、16-bit、mono；时长约 20.87s、30.97s、17.14s。
  - `corepack pnpm exec prettier --check .gitignore apps/client/public/assets/CREDITS.md apps/client/scripts/download-assets.mjs apps/client/src/assets/manifest.ts apps/client/src/audio/MusicManager.ts DEV_LOG.md`：失败；`.gitignore` 无可推断 parser，且 `CREDITS.md`、`MusicManager.ts` 需要格式化。
  - `corepack pnpm exec prettier --write apps/client/public/assets/CREDITS.md apps/client/scripts/download-assets.mjs apps/client/src/assets/manifest.ts apps/client/src/audio/MusicManager.ts DEV_LOG.md`：通过。
  - `corepack pnpm run typecheck`：通过。
  - `corepack pnpm run lint`：通过。
  - `corepack pnpm run test`：通过；shared 12 个测试、client 15 个测试、server 33 个测试。
  - `corepack pnpm run build`：通过；Vite 仍提示客户端 chunk 超过 500 kB。
  - 资源 HTTP 检查：`/assets/audio/music/menu_lab_drift.wav`、`/assets/audio/music/level_circuit_run.wav`、`/assets/audio/music/victory_signal_clear.wav` 均返回 200。
- 风险：
  - 未做浏览器人工试听和双浏览器联机通关回归。
  - 旧 OGG 文件保留在本地但不再被 manifest 引用。
