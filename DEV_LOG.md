# DEV_LOG.md

本日志记录当前 Godot 项目的 AI 文件修改历史。旧 Phaser / Colyseus / TypeScript 网页版项目已删除；当前仓库以 godot/ 为唯一游戏项目。

## 2026-04-26 17:00:00 +08:00

- 任务：创建 Godot 4.x 本地双人 2D 横版合作射击 MVP。
- 改动：新增 godot/ 独立项目，配置 project.godot、Main/Title/Game/Mission01 场景、GameState Autoload、输入映射；实现 P1/P2 本地双人、玩家移动/跳跃/下蹲/瞄准/射击/手雷/复活、WeaponData 与 4 种武器资源、Projectile/Grenade/Explosion、Health/Hurtbox/DamageInfo、Soldier/Gunner/Turret/Boss01、SpawnTrigger/SpawnDirector/Checkpoint/MissionController、HUD/PauseMenu；补充 Godot README、迁移计划、联网计划和 MVP 检查表。
- 文件：
  - godot/project.godot
  - godot/README.md
  - godot/docs/GODOT_MIGRATION_PLAN.md
  - godot/docs/NETWORK_PLAN.md
  - godot/docs/MVP_CHECKLIST.md
  - godot/resources/weapons/*.tres
  - godot/scenes/**/*.tscn
  - godot/scripts/**/*.gd
- 验证：初次创建时 Godot CLI 不可用，仅做资源路径和明显脚本问题扫描；随后安装 Godot 后补充完整校验。
- 风险：初版以可运行闭环为主，射击专用素材和关卡节奏仍需后续打磨。

## 2026-04-26 17:13:00 +08:00

- 任务：安装 Godot 并完成引擎级校验。
- 改动：通过 winget 安装 Godot Engine 4.6.2；修复 GDScript 在 Godot 4.6 下的校验问题，包括 Autoload 安全获取和显式类型标注；保留 Godot 自动生成的 .gd.uid 元数据文件。
- 文件：
  - godot/scripts/**/*.gd
  - godot/scripts/**/*.gd.uid
- 验证：
  - Godot_v4.6.2-stable_win64_console.exe --version：成功。
  - godot --headless --path godot --import --quit：成功。
  - 逐个 godot --headless --path godot --check-only --script 检查 27 个 GDScript：全部通过。
  - 临时 smoke test 加载 Game.tscn 并推进 3 帧：成功，P1 已生成。
- 风险：已完成 headless 校验，但仍需要实际可视化试玩微调手感、碰撞和刷怪节奏。

## 2026-04-26 17:22:00 +08:00

- 任务：复用当前项目已有美术和音频资源，替换纯色块原型观感。
- 改动：将旧网页项目 assets 迁移到 godot/assets；标题界面接入 lab_backdrop.png 和 menu_lab_drift.wav；Mission01 接入实验室背景、平台、墙体、出口、检查点贴图；玩家和人形敌人使用 players.png；Turret 使用机关贴图；接入关卡音乐和跳跃、死亡、复活音效；更新 Godot 文档说明资源来源和限制。
- 文件：
  - godot/assets/**
  - godot/assets/**/*.import
  - godot/scenes/main/Game.tscn
  - godot/scenes/ui/TitleScreen.tscn
  - godot/scenes/player/Player.tscn
  - godot/scenes/enemies/*.tscn
  - godot/scenes/levels/Mission01.tscn
  - godot/scripts/player/Player.gd
  - godot/scripts/enemies/*.gd
  - godot/README.md
  - godot/docs/GODOT_MIGRATION_PLAN.md
  - godot/docs/MVP_CHECKLIST.md
- 验证：
  - godot --headless --path godot --import --quit：成功，PNG/WAV/OGG 资源导入完成。
  - 逐个 GDScript check-only：全部通过。
  - smoke test 确认 P1 Sprite2D 绑定 players.png，Mission01 背景绑定 lab_backdrop.png。
- 风险：旧资源偏机关合作风格，缺少专门的枪械、弹体、爆炸和射击敌人素材。

## 2026-04-26 17:28:00 +08:00

- 任务：按用户确认删除旧 Phaser / Colyseus / TypeScript 网页版项目。
- 改动：结束旧网页游戏 dev 进程；删除 apps/、packages/、levels/、node_modules/、pnpm/TypeScript/ESLint/Prettier 配置、旧玩法/网络/关卡/部署文档和旧 dev 日志；根 README 改为 Godot 项目入口；.gitignore 改为当前 Godot 项目规则。
- 文件：
  - README.md
  - .gitignore
  - 删除 apps/
  - 删除 packages/
  - 删除 levels/
  - 删除 node_modules/
  - 删除 package.json、pnpm-lock.yaml、pnpm-workspace.yaml
  - 删除 tsconfig*.json、eslint.config.js、prettier.config.cjs、.prettierignore
  - 删除 GAME_DESIGN.md、NETWORK_SPEC.md、LEVEL_SCHEMA.md、LEVEL_NOTES.md、ROADMAP.md、DEPLOY.md
  - 删除 dev-*.log、dev-*.err.log
- 验证：
  - taskkill /T /F：成功结束旧 concurrently、Vite、server tsx watch 和 pnpm/corepack 子进程。
  - 删除操作：成功。
  - godot --headless --path godot --import --quit：成功。
  - 逐个 GDScript check-only：全部通过。
  - smoke test 加载 Game.tscn：成功。
- 风险：旧网页游戏源码和旧文档已从工作区删除；如需恢复只能从 Git 历史或备份恢复。

## 2026-04-26 17:32:00 +08:00

- 任务：更新当前项目说明和 AI 协作约束。
- 改动：根 README 补充当前文件说明；godot/README 修正旧项目状态、Godot 4.6 校验命令和生成文件说明；AGENTS.md 改为 Godot 项目约束，明确不恢复旧网页项目，补充 .import、.gd.uid、.godot/ 处理规则。
- 文件：
  - README.md
  - godot/README.md
  - AGENTS.md
  - .gitignore
  - DEV_LOG.md
- 验证：文档和约束更新，无需运行 Godot；git status 可见旧项目删除和 godot/ 新增。
- 风险：无代码行为变更。

## 2026-04-26 17:34:00 +08:00

- 任务：重写 DEV_LOG.md，使日志匹配当前只保留 Godot 项目的状态。
- 改动：将此前冗长的旧项目与中间试错记录整理为当前 Godot 项目的关键历史节点；保留后续继续追加的日志格式。
- 文件：
  - DEV_LOG.md
- 验证：执行 git status 检查工作区状态。
- 风险：删除了详细逐步过程日志，但保留了关键任务、文件、验证和风险摘要。
