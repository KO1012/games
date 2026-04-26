# MVP Checklist

## 可运行检查项

- [x] godot/project.godot 存在。
- [x] 主场景指向 res://scenes/main/Main.tscn。
- [x] Autoload GameState 配置完成。
- [x] Main 进入 TitleScreen。
- [x] TitleScreen 可以进入 Game / Mission01。

## 玩家检查项

- [x] P1 默认出生。
- [x] P2 可按 p2_join 加入。
- [x] CharacterBody2D 移动在 _physics_process 中执行。
- [x] 左右移动、跳跃、重力、下蹲。
- [x] 前、上、下、斜向瞄准。
- [x] 射击、手雷、切枪。
- [x] 受伤、死亡、检查点复活、无敌闪烁。

## 武器检查项

- [x] WeaponData Resource。
- [x] Pistol 无限弹药。
- [x] Machine Gun 高射速。
- [x] Shotgun 多弹丸散射。
- [x] Rocket Launcher 爆炸伤害。
- [x] Projectile、Grenade、Explosion 场景和脚本。

## 敌人检查项

- [x] EnemyBase 通用基础。
- [x] Soldier。
- [x] Gunner。
- [x] Turret。
- [x] Boss01。
- [x] 敌人可通过 Hurtbox/Health 受伤死亡。
- [x] 敌人可发射子弹伤害玩家。

## 关卡检查项

- [x] Mission01 基础横版地图。
- [x] StaticBody2D 地面、平台、墙体。
- [x] 至少 3 段推进触发器。
- [x] Checkpoint。
- [x] Boss 区域。
- [x] Boss 死亡后通关。

## UI 检查项

- [x] P1 血量。
- [x] P2 状态。
- [x] 当前武器。
- [x] 弹药。
- [x] Boss 血条。
- [x] 通关和提示消息。
- [x] PauseMenu。

## 美术资源检查项

- [x] 复制旧项目现有资源到 godot/assets。
- [x] 标题背景使用 lab_backdrop.png。
- [x] Mission01 使用 lab_backdrop.png、platform_solid.png、wall_tile.png、exit_zone.png、button_active.png。
- [x] 玩家和人形敌人使用 players.png。
- [x] 标题/关卡音乐和跳跃、死亡、复活音效接入现有音频。
- [ ] 射击专用武器、弹体、爆炸、敌人素材仍需后续补齐。

## 后续待办

- [ ] 用 Godot 编辑器实际运行后调碰撞和敌人出生位置。
- [ ] 增加玩家可拾取的显式武器箱。
- [ ] 增加音效和动画，但继续使用原创或 CC0 资源。
- [ ] 增加更多关卡和自动化 smoke test。
- [ ] 按 NETWORK_PLAN 接在线合作。
