# DEPLOY.md

本文档给出 VPS 部署方案。生产环境建议使用域名和 HTTPS，并通过 Nginx 转发 WebSocket。

## 构建前提

- VPS：Ubuntu 22.04/24.04 或等价 Linux 发行版
- Node.js：20+
- 包管理器：Corepack + pnpm
- 反向代理：Nginx
- 进程管理：PM2 或 Docker 二选一
- 域名：示例使用 `game.example.com`

## 环境变量

服务端至少需要：

```bash
PORT=2567
NODE_ENV=production
```

不要把 `.env` 提交到 Git。生产环境建议用 PM2 ecosystem、systemd EnvironmentFile、Docker Compose env_file 或 VPS 的秘密配置管理。

## 方案 A：PM2 部署

### 1. 拉取代码并安装

```bash
git clone https://github.com/KO1012/games.git
cd games
corepack enable
corepack pnpm install --frozen-lockfile
```

### 2. 构建

```bash
corepack pnpm run build
```

### 3. 启动服务端

```bash
corepack pnpm add -g pm2
PORT=2567 NODE_ENV=production pm2 start apps/server/dist/index.js --name coop-game-server
pm2 save
pm2 startup
```

客户端静态文件位于：

```text
apps/client/dist/
```

可由 Nginx 直接托管。

### 4. Nginx 配置

```nginx
server {
  listen 80;
  server_name game.example.com;

  root /var/www/games/apps/client/dist;
  index index.html;

  location / {
    try_files $uri $uri/ /index.html;
  }

  location /ws/ {
    proxy_pass http://127.0.0.1:2567/;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_read_timeout 86400;
  }
}
```

启用 HTTPS：

```bash
sudo certbot --nginx -d game.example.com
```

客户端生产连接地址应配置为 `wss://game.example.com/ws` 或项目约定的服务端地址。

## 方案 B：Docker 部署

可使用多阶段 Dockerfile，把 shared、client、server 一起构建，再运行服务端并由 Nginx 托管客户端静态资源。

示例 `docker-compose.yml`：

```yaml
services:
  server:
    build: .
    environment:
      NODE_ENV: production
      PORT: 2567
    ports:
      - "2567:2567"
    restart: unless-stopped

  nginx:
    image: nginx:1.27-alpine
    volumes:
      - ./apps/client/dist:/usr/share/nginx/html:ro
      - ./deploy/nginx.conf:/etc/nginx/conf.d/default.conf:ro
    ports:
      - "80:80"
      - "443:443"
    depends_on:
      - server
    restart: unless-stopped
```

部署流程：

```bash
corepack pnpm install --frozen-lockfile
corepack pnpm run build
docker compose up -d --build
```

## 发布检查

发布前运行：

```bash
corepack pnpm run typecheck
corepack pnpm run lint
corepack pnpm run test
corepack pnpm run build
```

发布后检查：

- 浏览器能打开公网域名。
- 两个浏览器实例能进入同一房间。
- 第三个浏览器加入会被拒绝。
- 两名玩家 ready 后进入 `playing`。
- WebSocket 走 `wss://`，浏览器控制台无混合内容错误。

