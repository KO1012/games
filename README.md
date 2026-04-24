# Coop Puzzle Game

双人远程联机合作机关闯关网页游戏。客户端负责输入采集和画面表现，服务端使用 Colyseus 作为权威逻辑来源，处理房间、输入、移动、碰撞、机关、复活、关卡切换和重开投票。

## 技术栈

- Monorepo：pnpm workspace
- 客户端：Phaser + TypeScript + Vite
- 服务端：Colyseus + Node.js + TypeScript
- 共享包：TypeScript 协议类型、常量、关卡 schema
- 测试：Vitest
- 代码检查：ESLint + Prettier

## 目录结构

```text
apps/
  client/      # Phaser + Vite 客户端
  server/      # Colyseus 服务端
packages/
  shared/      # 共享协议、常量、关卡 schema
levels/        # 关卡 JSON
```

## 安装

需要 Node.js 20+，并启用 Corepack。

```bash
corepack enable
corepack pnpm install
```

## 运行

同时启动客户端和服务端：

```bash
corepack pnpm run dev
```

单独启动客户端：

```bash
corepack pnpm run dev:client
```

单独启动服务端：

```bash
corepack pnpm run dev:server
```

默认端口：

- 客户端：`5173`
- 服务端：`2567`

## 测试与检查

```bash
corepack pnpm run typecheck
corepack pnpm run lint
corepack pnpm run test
```

## 构建

```bash
corepack pnpm run build
```

构建产物位于各 workspace 的 `dist/`，不要提交到 Git。

## 常见问题

### 客户端连不上服务端

确认服务端正在运行，默认地址是 `ws://localhost:2567`。如果部署到公网，需要让客户端使用对应的 HTTPS/WSS 域名，并确保 Nginx 正确转发 WebSocket。

### 第三个玩家无法加入

这是预期行为。MVP 房间固定为 2 人，满员后拒绝第三名玩家。

### `build` 提示 chunk 超过 500 kB

当前 Phaser 打包体积会触发 Vite 警告，但不影响构建成功。后续可通过动态导入或手动分包优化。

### 刷新页面后不能 30 秒重连

断线 30 秒重连尚未实现，当前刷新会按离开房间处理。该能力已在 `NETWORK_SPEC.md` 和 `ROADMAP.md` 标为 TODO。

### `.env`、`dist/`、`node_modules/` 是否应该提交

不应该提交。仓库通过 `.gitignore` 排除了依赖目录、构建产物、日志和环境变量文件。

