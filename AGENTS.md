# AGENTS.md

## 项目定位

这是一个双人远程联机网页游戏项目：

- 客户端：Phaser + TypeScript + Vite
- 服务器：Colyseus + Node.js + TypeScript
- 部署目标：自有 VPS
- 核心玩法：2 人合作机关闯关

当前项目已经进入实现阶段。允许在明确任务范围内修改游戏功能、服务端逻辑、客户端表现、测试和部署文档；没有明确任务时，不要新增玩法、关卡或做大范围重构。

## 回复规则

- 使用中文，回复简洁，只讲和项目有关的内容。
- 不要加入无关表演、玩笑或自我叙述。
- 说明修改内容、验证结果和剩余风险即可。
- 如果发现需求冲突，先指出冲突，再给出建议处理方式。

## 推荐目录结构

实现阶段优先按下面结构组织：

```text
/
  apps/
    client/            # Phaser + Vite 客户端
    server/            # Colyseus 服务端
  packages/
    shared/            # 客户端/服务端共享类型、协议常量、关卡类型
  levels/              # 关卡 JSON
  docs/                # 可选的补充设计文档
  AGENTS.md
  GAME_DESIGN.md
  NETWORK_SPEC.md
  LEVEL_SCHEMA.md
  LEVEL_NOTES.md
  DEV_LOG.md
  ROADMAP.md
```

## AI 变更记录规则

以后任何 AI 修改项目文件，都必须同步维护根目录 `DEV_LOG.md`。

记录要求：

- 每次改动追加一条记录，不能覆盖历史记录。
- 日志必须按时间从旧到新排序；新记录只能追加到 `DEV_LOG.md` 文件末尾，不要插入到文件顶部或历史记录中间。
- 时间使用本地时间，格式：`YYYY-MM-DD HH:mm:ss +08:00`。
- 必须写清楚：
  - 本次任务目标。
  - 主要改动内容。
  - 实际改动过的文件列表。
  - 运行过的验证命令和结果。
  - 未验证内容或剩余风险。
- 如果只做了分析、没有修改文件，可以不写 `DEV_LOG.md`，但回复里要说明没有文件改动。
- 如果修改了 `AGENTS.md`、`GAME_DESIGN.md`、`NETWORK_SPEC.md`、`LEVEL_SCHEMA.md`、`ROADMAP.md` 等约束文档，也必须记录。

推荐记录模板：

```markdown
## YYYY-MM-DD HH:mm:ss +08:00

- 任务：
- 改动：
- 文件：
- 验证：
- 风险：
```

## 运行与开发命令

根目录提供统一 pnpm scripts。Codex 添加或修改命令时，需要同步更新本节。

常用命令：

```bash
corepack pnpm install
corepack pnpm run dev            # 同时启动客户端和服务端
corepack pnpm run dev:client     # 启动 Vite 客户端
corepack pnpm run dev:server     # 启动 Colyseus 服务端
corepack pnpm run build          # 构建 client/server/shared
corepack pnpm run typecheck      # 全量 TypeScript 类型检查
corepack pnpm run lint           # 代码风格检查
corepack pnpm run test           # 自动化测试
```

推荐默认端口：

- 客户端开发服：`5173`
- 服务端开发服：`2567`
- Colyseus Monitor：仅开发环境开启，不暴露到公网

## 测试要求

新增或修改功能时，至少覆盖对应层级：

- `shared`：协议类型、关卡 schema 校验、纯函数单元测试。
- `server`：房间加入/离开、输入处理、机关状态、胜负条件、断线重连测试。
- `client`：输入采集、状态插值、场景切换、基础 UI 交互测试。
- 联调：2 个浏览器实例进入同一房间，完成一关。

验收前必须运行：

```bash
corepack pnpm run typecheck
corepack pnpm run lint
corepack pnpm run test
corepack pnpm run build
```

如果某条命令暂时不存在，先说明原因；实现阶段应尽快补齐。

## 提交规则

- 每次提交只包含一个可独立验收的任务。
- 不要把格式化、重命名、重构和功能开发混在一个提交里。
- 提交信息使用简洁英文或中文均可，格式建议：

```text
docs: add network protocol spec
feat(server): add two-player room lifecycle
fix(client): handle reconnect state sync
```

- 提交前检查 `git diff`，不要提交无关文件、构建产物、日志、`.env`。

## 禁止事项

- 未经明确任务不要新增玩法、关卡、协议字段或大范围重构。
- 不要把客户端作为权威逻辑来源；移动、碰撞、机关、通关判定都应由服务端决定。
- 不要引入 P2P、WebRTC 或第三方托管多人服务替代 Colyseus，除非文档先更新并获得确认。
- 不要硬编码 VPS IP、域名、密钥、数据库密码或 Colyseus secret。
- 不要提交 `dist/`、`node_modules/`、日志、临时截图、私有证书。
- 不要绕过 `LEVEL_SCHEMA.md` 直接写非规范关卡字段。
- 不要做大范围无关重构。
- 不要使用破坏性 git 命令回滚用户改动。

## 实现原则

- 服务器权威，客户端只发送输入和展示预测/插值结果。
- 协议字段先写入 `NETWORK_SPEC.md`，再实现。
- 关卡字段先写入 `LEVEL_SCHEMA.md`，再使用。
- 新机制先做最小可玩闭环，再扩展表现。
- 任何影响客户端和服务端的数据结构应放入 `shared/`。
- 复杂玩法优先写自动化测试，再接入关卡。
