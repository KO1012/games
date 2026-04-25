# NETWORK_SPEC.md

## 架构原则

本项目采用服务器权威模型。

- 客户端只发送输入，不直接决定位置、碰撞、机关、死亡、通关。
- 服务端运行房间逻辑、物理判定、机关状态和关卡进度。
- 客户端接收服务端状态，用插值和轻量预测改善手感。
- 所有影响玩法的协议字段需要先写入本文件，再实现。

## 当前实现状态

- 已实现：2 人房间创建/加入、满员拒绝、ready 流转、输入快照、服务端权威移动/碰撞、机关状态、关卡完成、重开投票、30 秒断线重连、`ping`/`pong`。
- 当前实现使用 `room_state` 消息广播完整房间快照；尚未使用 Colyseus Schema state patch。
- 断线后服务端保留席位 30 秒；客户端使用 Colyseus `reconnectionToken` 回到原席位。

## 技术栈

- 传输与房间：Colyseus WebSocket。
- 服务端运行时：Node.js + TypeScript。
- 客户端：Phaser + TypeScript。
- 共享协议类型：放在 `shared/`。

## Tick 与同步频率

推荐默认值：

- 服务端模拟 tick：`60Hz`。
- 客户端输入发送：`20Hz`，输入变化时可立即补发。
- 服务端状态广播：`20Hz`，通过 Colyseus state patch 同步。
- 客户端渲染：跟随浏览器刷新率。

时间单位：

- 协议中的持续时间统一使用毫秒。
- 位置、速度、尺寸使用关卡世界单位；MVP 可直接使用像素单位。

## 房间生命周期

```text
created
  -> waiting
  -> readyCheck
  -> loadingLevel
  -> playing
  -> levelComplete
  -> finished
```

状态说明：

- `waiting`：等待第二名玩家加入。
- `readyCheck`：两名玩家都在房间内，等待 ready。
- `loadingLevel`：服务端切换关卡并发送初始状态。
- `playing`：正常游戏中。
- `levelComplete`：当前关卡完成，短暂停顿后进入下一关。
- `finished`：第 10 关完成。

## 加入房间

创建房间参数：

```json
{
  "playerName": "Player",
  "clientVersion": "0.1.0"
}
```

通过房间码加入时，客户端使用 Colyseus `joinById(roomCode, options)`；`roomCode` 不在 options 内传递。

加入房间 options：

```json
{
  "playerName": "Player",
  "clientVersion": "0.1.0"
}
```

服务端规则：

- 房间最多 2 名玩家。
- 第 1 名玩家分配 `playerIndex = 0`。
- 第 2 名玩家分配 `playerIndex = 1`。
- 满员后锁定房间。
- 版本不兼容时拒绝加入。

## 客户端发送消息

### `client_ready`

玩家进入房间后发送。

```json
{
  "type": "client_ready",
  "ready": true
}
```

### `input`

客户端按固定频率发送输入快照。

```json
{
  "type": "input",
  "seq": 1204,
  "clientTime": 18333421,
  "left": false,
  "right": true,
  "jump": false,
  "jumpPressed": true,
  "down": false,
  "interactPressed": false
}
```

字段说明：

- `seq`：客户端递增输入序号。
- `clientTime`：客户端本地毫秒时间，只用于延迟估算和调试。
- `left/right/down/jump`：当前是否按住。
- `jumpPressed`：这一帧是否新按下跳跃，用于跳跃缓冲。
- `interactPressed`：这一帧是否新按下交互。

服务端处理：

- 每名玩家只接受递增 `seq`。
- 丢弃过旧或频率异常的输入。
- 对同一 tick 使用该玩家最新输入。

### `restart_vote`

请求重开当前关卡。

```json
{
  "type": "restart_vote",
  "approve": true
}
```

规则：

- 任一玩家可发起。
- 两名玩家都同意后重置当前关卡。
- 玩家离开房间时清空投票。

### `select_level`

房主选择要进入的关卡。

```json
{
  "type": "select_level",
  "levelIndex": 9
}
```

规则：

- 仅 `role = "A"` 的玩家可发送。
- `levelIndex` 从 `0` 开始，对应关卡列表顺序。
- 服务端忽略越界或当前不存在的关卡。
- 切换关卡会重置所有玩家 ready、重开投票、出生点和机关状态。
- 切换后根据在线人数回到 `waiting` 或 `readyCheck`，再由双方 ready 进入 `playing`。
- `loadingLevel` 阶段忽略该消息。

### `ping`

可选调试消息。Colyseus 自带延迟能力可用时优先使用内置能力。

```json
{
  "type": "ping",
  "clientTime": 18333421
}
```

## 服务端广播状态

当前 MVP 通过 `room_state` 消息广播完整房间快照。后续如果切换到 Colyseus Schema state patch，状态字段仍应保持小而稳定。

### RoomState

```json
{
  "phase": "playing",
  "roomCode": "ABCD",
  "levelId": "level-001",
  "levelIndex": 0,
  "level": {},
  "serverTime": 92000,
  "players": {},
  "buttons": {},
  "doors": {},
  "traps": {},
  "movingPlatforms": {},
  "restartVotes": {}
}
```

### PlayerState

```json
{
  "sessionId": "colyseus-session-id",
  "playerIndex": 0,
  "name": "Player",
  "connected": true,
  "ready": true,
  "x": 120,
  "y": 320,
  "vx": 0,
  "vy": 0,
  "facing": 1,
  "grounded": true,
  "alive": true,
  "respawnAt": 0,
  "lastProcessedInputSeq": 1204
}
```

### ButtonState

```json
{
  "id": "button-a",
  "active": true,
  "pressedBy": ["p0"],
  "cooldownUntil": 0
}
```

### DoorState

```json
{
  "id": "door-a",
  "open": true,
  "locked": false,
  "progress": 1
}
```

### TrapState

```json
{
  "id": "laser-a",
  "enabled": true,
  "active": false,
  "phaseMs": 1200
}
```

### MovingPlatformState

```json
{
  "id": "platform-a",
  "x": 400,
  "y": 240,
  "vx": 60,
  "vy": 0,
  "active": true,
  "pathIndex": 1
}
```

## 服务端事件消息

除 Schema 状态外，可发送一次性事件。

### `level_start`

```json
{
  "type": "level_start",
  "levelId": "level-001",
  "levelIndex": 0,
  "level": {},
  "serverTime": 90000
}
```

### `player_died`

```json
{
  "type": "player_died",
  "playerIndex": 1,
  "reason": "spike",
  "respawnDelayMs": 800
}
```

### `level_complete`

```json
{
  "type": "level_complete",
  "levelId": "level-001",
  "nextLevelId": "level-002",
  "completeTimeMs": 83120
}
```

### `room_error`

```json
{
  "type": "room_error",
  "code": "ROOM_FULL",
  "message": "Room is full"
}
```

### `input_debug`

仅在服务端 `INPUT_DEBUG=1` 时广播，用于方向键问题定位，不参与玩法逻辑。

```json
{
  "type": "input_debug",
  "source": "server",
  "at": 18333421,
  "event": {
    "kind": "physics-x",
    "role": "A",
    "seq": 1204,
    "axisX": 1,
    "previousX": 160,
    "attemptedX": 164.33,
    "finalX": 164.33,
    "blocked": false,
    "collisionId": null
  }
}

## 错误码

- `ROOM_FULL`：房间已满。
- `ROOM_LOCKED`：房间已锁定。
- `VERSION_MISMATCH`：客户端版本不兼容。
- `LEVEL_NOT_FOUND`：关卡不存在或加载失败。
- `INVALID_INPUT`：输入消息格式错误。
- `RATE_LIMITED`：消息过于频繁。
- `RECONNECT_EXPIRED`：重连窗口已过期。

## 重连规则

- 玩家断线后，服务端保留席位 `30s`。
- 断线玩家状态标记为 `connected = false`。
- 断线期间角色停止接受输入并停在当前位置。
- 客户端保存 `room.reconnectionToken`，异常断开或刷新页面后使用 `client.reconnect(token)` 回到原席位。
- 玩家回连后，服务端重新发送 `room_joined` 与当前 `level_start`。
- 超过 `30s` 未重连，服务端移除席位，将剩余玩家 ready 置回 `false`，房间退回 `waiting`。

## 客户端表现策略

- 本地玩家可做轻量预测，但必须被服务端位置校正。
- 远程玩家使用插值，不做客户端碰撞判定。
- 门、陷阱、平台以服务端状态为准。
- 如果校正距离小于阈值，可平滑拉回；超过阈值直接瞬移到权威位置。

推荐阈值：

- 小校正：`<= 12` 单位，`100ms` 内平滑。
- 大校正：`> 12` 单位，立即修正。

## 安全与校验

服务端必须校验：

- 输入字段类型。
- 输入频率。
- `seq` 单调递增。
- 玩家是否属于该房间。
- 玩家是否处于可操作状态。
- 关卡实体引用是否存在。

服务端不得相信：

- 客户端上报的位置。
- 客户端上报的碰撞。
- 客户端上报的通关。
- 客户端上报的机关状态。

## 独立验收任务

- N-01：定义 `shared` 协议类型，与本文件字段一致。
- N-02：实现 2 人 Colyseus 房间创建、加入、锁定。
- N-03：实现 `client_ready` 和房间状态流转。
- N-04：实现输入序号、频率限制和服务端输入缓存。
- N-05：实现服务端权威 PlayerState 广播。
- N-06：实现按钮、门、陷阱、移动平台状态广播。
- N-07：实现关卡完成事件和下一关切换。
- N-08：实现 30 秒断线重连。
- N-09：实现客户端插值与服务端校正。
- N-10：完成 VPS 环境下双客户端联机测试。
