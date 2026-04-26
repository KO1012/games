# AGENTS.md

## 项目定位

这是一个 Godot 4.x + GDScript 的 2D 横版本地双人合作射击游戏 MVP。

- 引擎：Godot 4.6.x
- 语言：GDScript
- 当前入口：`godot/project.godot`
- 主场景：`res://scenes/main/Main.tscn`
- 核心玩法：本地双人 run-and-gun，P1 默认存在，P2 按加入键加入
- 当前范围：单机 + 本地双人优先，暂不做在线联机

旧 Phaser / Colyseus / TypeScript 网页版项目已删除。后续不要再恢复 `apps/`、`packages/`、`levels/`、pnpm workspace 或旧网页联机架构，除非用户明确要求。

## 回复规则

- 使用中文，回复简洁，只讲和项目有关的内容。
- 不要加入无关表演、玩笑或自我叙述。
- 说明修改内容、验证结果和剩余风险即可。
- 如果发现需求冲突，先指出冲突，再给出建议处理方式。

## 当前目录结构

```text
/
  godot/
    assets/       # 从旧项目迁移的现有 CC0 / 项目定制资源
    docs/         # Godot 重做、联网计划、MVP 检查表
    resources/    # WeaponData 等 Godot 资源
    scenes/       # Godot 场景
    scripts/      # GDScript 逻辑
    project.godot
    README.md
  AGENTS.md
  DEV_LOG.md
  README.md
```

## AI 变更记录规则

任何 AI 修改项目文件，都必须同步维护根目录 `DEV_LOG.md`。

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
- 如果修改了 `AGENTS.md`、`README.md`、`godot/docs/*.md`、`godot/project.godot` 等约束或入口文件，也必须记录。

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

当前没有 Node/pnpm 项目脚本。使用 Godot 运行和检查：

```bash
godot --path godot
godot --headless --path godot --import --quit
godot --headless --path godot --check-only --script res://scripts/player/Player.gd
```

如果本机 Godot 命令未加入 PATH，可使用已安装的 winget 路径：

```text
%LOCALAPPDATA%\Microsoft\WinGet\Packages\GodotEngine.GodotEngine_Microsoft.Winget.Source_8wekyb3d8bbwe\Godot_v4.6.2-stable_win64_console.exe
```

Godot 4.6 的 `--check-only` 需要配合 `--script` 使用；全量脚本检查需要逐个 `.gd` 文件执行。

## 测试要求

新增或修改功能时，按改动范围尽量覆盖：

- 脚本语法：逐个运行 `godot --headless --path godot --check-only --script <script>`。
- 资源导入：运行 `godot --headless --path godot --import --quit`。
- 场景 smoke：至少加载 `res://scenes/main/Game.tscn` 并确认 P1 能生成。
- 可玩性：涉及操作、碰撞、刷怪、Boss、HUD 时，优先打开 Godot 可视化试玩。

如果无法运行 Godot CLI，必须在回复和 `DEV_LOG.md` 里说明原因。

## 提交规则

- 每次提交只包含一个可独立验收的任务。
- 不要把格式化、重命名、重构和功能开发混在一个提交里。
- 提交前检查 `git diff`，不要提交无关文件、导出产物、日志、`.env`、本地缓存。
- `godot/assets/**/*.import` 和 `godot/scripts/**/*.gd.uid` 是 Godot 元数据，应随对应资源/脚本提交。
- `godot/.godot/` 是本地导入缓存，不提交。

## 禁止事项

- 未经明确任务不要新增大玩法、关卡批量内容或大范围重构。
- 不要恢复旧 Phaser / Colyseus / TypeScript 网页项目。
- 不要重新引入 Node/pnpm workspace 作为主项目结构。
- 不要使用受版权保护的角色、素材、音效、关卡或命名。
- 不要引入大型第三方 Godot 插件，除非先获得确认。
- 不要提交 Godot 导出产物、`.godot/` 缓存、日志、临时截图、私有证书、密钥或 `.env`。
- 不要删除或覆盖用户未要求处理的文件。
- 不要使用破坏性 git 命令回滚用户改动。

## 实现原则

- 以“能打开、能玩、能继续开发”为优先级。
- 先保持单机 + 本地双人闭环稳定，再考虑在线联机。
- 玩家移动使用 `CharacterBody2D` 和 `_physics_process`，不要直接硬改位置实现常规移动。
- 玩法逻辑优先拆成可复用组件，例如 `Health`、`Hurtbox`、`WeaponController`、`SpawnDirector`。
- 关键参数优先用 `@export` 暴露，避免散落魔法数字。
- 现有 `godot/assets/` 资源优先复用；缺少射击专用素材时，先用同风格占位或程序化形状。
- 后续在线方案参考 `godot/docs/NETWORK_PLAN.md`，仍以服务端权威为原则。
