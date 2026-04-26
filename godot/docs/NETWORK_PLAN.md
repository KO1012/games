# Network Plan

## 第一阶段：本地双人

当前 MVP 只实现本地双人：

- P1 默认存在。
- P2 按 p2_join 加入。
- 两名玩家共用本机 MissionController、SpawnDirector、Health 和 WeaponController。
- Player.gd 保留 player_id、team、input_state、server_authoritative 注释，方便后续替换输入来源。

## 第二阶段：Godot Dedicated Server + ENet

建议第二阶段使用 Godot Headless Dedicated Server + ENet：

- 客户端发送输入帧，不发送位置结论。
- 服务端运行 CharacterBody2D 或等价权威运动逻辑。
- 服务端创建敌人、子弹、爆炸、掉落和任务事件。
- 客户端接收快照，做插值和轻量预测。
- 断线重连、房间码、准备流程可以独立做房间服务。

## 备选方案：保留 Colyseus 做房间服务

可以保留旧 Colyseus：

- Colyseus 负责房间创建、加入、邀请码、断线席位保留。
- Godot 客户端连接 Colyseus 获取房间元信息。
- 实时战斗同步仍建议交给 Godot ENet 或专门权威模拟服务。

如果继续让 Colyseus 负责全部实时模拟，需要把 GDScript 玩法规则重新实现到 TypeScript 服务端，维护成本更高。

## 服务端权威原则

- 客户端只上传 input。
- 服务端决定位置、碰撞、射击生成、命中、伤害、死亡、复活、掉落、Boss 和通关。
- 客户端可以预测本地位移，但必须接受服务端校正。
- 任何影响玩法的状态必须有稳定 id 和版本。

## 需要同步的内容

- player input：方向、跳跃、射击、手雷、切枪、交互、输入序号。
- player state：位置、速度、朝向、血量、当前武器、弹药、死亡/复活状态。
- enemy state：敌人 id、类型、位置、速度、血量、状态机阶段、目标。
- projectile spawn events：子弹类型、来源、阵营、位置、方向、速度、伤害。
- damage events：伤害来源、目标、数值、击退、死亡。
- pickups：掉落 id、类型、位置、是否已拾取。
- mission events：触发器、检查点、Boss 出现、Boss 死亡、通关、重开。

## 不同步的内容

- 枪口闪光。
- 命中火花。
- 普通屏幕震动。
- 纯视觉爆炸残影。
- 本地 HUD 动画。
