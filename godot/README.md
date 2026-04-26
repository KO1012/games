# Godot Run-and-Gun Remake MVP

这是 Godot 4.x + GDScript 本地双人 2D 横版合作射击 MVP。旧的 Phaser / Colyseus / TypeScript 网页版项目已删除，当前仓库只保留这个 Godot 项目。

## 如何打开

1. 安装 Godot 4.x。
2. 在 Godot Project Manager 中导入 godot/project.godot。
3. 打开后运行主场景 res://scenes/main/Main.tscn。

也可以在命令行检查：

~~~bash
godot --headless --path godot --import --quit
~~~

Godot 4.6 的 `--check-only` 需要配合 `--script` 使用，例如：

~~~bash
godot --headless --path godot --check-only --script res://scripts/player/Player.gd
~~~

## 控制

P1：
- WASD：移动与瞄准
- K：跳跃
- J：射击
- L：手雷
- U：切换武器
- I：交互预留

P2：
- Enter：加入，也用于射击
- 方向键：移动与瞄准
- Shift：跳跃
- .：手雷
- /：切换武器
- '：交互预留

通用：
- Esc：暂停
- R：重开任务

## 当前 MVP 功能

- 复用旧项目 `apps/client/public/assets` 中的现有 CC0 / 项目定制资源，已复制到 `godot/assets`。
- 标题界面、Mission01 背景、玩家、敌人、平台、墙体、出口、检查点和基础音乐/音效已接入现有资源。
- 标题界面进入 Mission01。
- CharacterBody2D 玩家移动、跳跃、下蹲、半八方向瞄准。
- P1 默认存在，P2 本地按 Join 加入。
- 共享 CoopCamera 跟随两名玩家。
- 4 种武器资源：Pistol、Machine Gun、Shotgun、Rocket Launcher。
- 子弹、手雷、爆炸、枪口闪光、受击闪烁、屏幕震动。
- Health / Hurtbox / DamageInfo 通用伤害组件。
- Soldier、Gunner、Turret、Boss01。
- SpawnTrigger、SpawnDirector、Checkpoint、MissionController。
- Boss 死亡后显示 MISSION CLEAR。

## 已知限制

- 当前只做单机本地双人，没有在线同步。
- 射击相关子弹、爆炸和部分敌人表现仍是占位实现；旧项目没有专门的射击敌人与武器素材。
- Boss 区域镜头锁只做 HUD 提示，未实现硬锁边界。
- P2 使用键盘右侧按键，和部分键盘布局可能冲突。
- 还没有 Godot 自动化测试场景。

## 资源与生成文件

- `assets/`：从旧网页项目迁移过来的现有 CC0 / 项目定制资源。
- `assets/**/*.import`：Godot 导入 PNG/WAV/OGG 后生成的导入元数据，需要保留。
- `scripts/**/*.gd.uid`：Godot 4 为 GDScript 生成的资源 UID，需要保留。
- `.godot/`：本地导入缓存，不提交。
- `export/`：后续导出产物目录，不提交。

## 下一步路线

1. 用 Godot 编辑器打开并微调碰撞、刷怪位置和镜头边界。
2. 基于现有实验室/机关视觉风格补专门的武器、敌人、子弹和爆炸素材。
3. 增加更明确的敌人出生提示、掉落表现和通关出口。
4. 把武器、敌人、Boss 参数继续外置成 Resource。
5. 追加 Godot 原生测试或 smoke test 场景。
6. 按 docs/NETWORK_PLAN.md 设计 Dedicated Server / ENet 在线合作。
