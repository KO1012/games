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
