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

## 美术与音频资源

仓库 **不提交任何二进制资源**（`.gitignore` 已忽略 `apps/client/public/assets/{sprites,bg,audio}/` 与 `apps/client/.asset-cache/`）。客户端启动时优先尝试加载 `apps/client/public/assets/` 下的精灵图与音频；若文件缺失，自动回退到程序化生成的像素美术与 Web Audio 合成音乐/音效，所以仓库克隆后可直接 `pnpm run dev` 游玩。

下载完整版资源（CC0，全部来自 [Kenney](https://kenney.nl)）：

```bash
node apps/client/scripts/download-assets.mjs
```

脚本逻辑：

1. 直连每个 Kenney 资源页，正则抓取真实 ZIP 直链。
2. 下载到 `apps/client/.asset-cache/`（缓存，第二次运行复用）。
3. 用内置 ZIP 解析器（`node:zlib` inflateRaw）按规则提取目标文件到 `apps/client/public/assets/{sprites,audio/music,audio/sfx}/`。
4. 全部为 CC0，无新增 npm 依赖，需要 Node 20+。

下载后的资源映射表见 `apps/client/public/assets/CREDITS.md`。重新运行 `pnpm run dev:client` 后，PreloadScene 会自动检测新文件并切换到外部资源；Phaser 的 spritesheet 帧、音乐 OGG、音效 OGG 都会替换对应的程序化兜底。

游戏左下角的 🔊 按钮可调整音乐 / 音效音量并切换静音；偏好通过 `localStorage` 持久化。

> 当 Kenney 改版页面结构、ZIP 直链失效时，脚本会报错指向哪个 slug 失败；可参考 `download-assets.mjs` 中的 `findZipUrl` 调整正则，或手工把所需文件按 `CREDITS.md` 的目录结构放入 `public/assets/`。

## 常见问题

### 客户端连不上服务端

确认服务端正在运行，默认地址是 `ws://localhost:2567`。如果部署到公网，需要让客户端使用对应的 HTTPS/WSS 域名，并确保 Nginx 正确转发 WebSocket。

### 第三个玩家无法加入

这是预期行为。MVP 房间固定为 2 人，满员后拒绝第三名玩家。

### `build` 提示 chunk 超过 500 kB

当前 Phaser 打包体积会触发 Vite 警告，但不影响构建成功。后续可通过动态导入或手动分包优化。

### 刷新页面后如何 30 秒重连

房间连接后客户端会保存 Colyseus `reconnectionToken`。异常断线或刷新页面后，30 秒内重新打开客户端会优先回连原房间；超过窗口后服务端会移除席位。

### `.env`、`dist/`、`node_modules/` 是否应该提交

不应该提交。仓库通过 `.gitignore` 排除了依赖目录、构建产物、日志和环境变量文件。
