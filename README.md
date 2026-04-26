# Coop Circuit Raid

Godot 4.x 本地双人 2D 横版合作射击 MVP。旧 Phaser / Colyseus / TypeScript 网页版项目已删除，当前仓库只保留 Godot 版本。

## 打开项目

使用 Godot 4.6.x 导入：

```text
E:\games\godot\project.godot
```

或命令行运行：

```bash
godot --path godot
```

当前主场景：

```text
res://scenes/main/Main.tscn
```

## 控制

P1：WASD 移动/瞄准，K 跳跃，J 射击，L 手雷，U 切枪，I 交互预留。

P2：Enter 加入/射击，方向键移动/瞄准，Shift 跳跃，. 手雷，/ 切枪，' 交互预留。

通用：Esc 暂停，R 重开任务。

## 项目结构

```text
AGENTS.md      # AI 协作和项目约束
DEV_LOG.md     # AI 修改记录，按时间追加
README.md      # 当前入口说明
godot/
  assets/       # 从旧项目迁移的现有 CC0 / 项目定制资源
  scenes/       # Godot 场景
  scripts/      # GDScript 逻辑
  resources/    # WeaponData 等资源
  docs/         # Godot 重做、联网计划、MVP 检查表
```

## 文件说明

- `godot/assets/**/*.import`：Godot 导入资源时生成的元数据，需要随资源提交。
- `godot/scripts/**/*.gd.uid`：Godot 4 为脚本生成的资源 UID，需要随脚本提交。
- `godot/.godot/`：Godot 本地导入缓存，已忽略，不提交。
- `.tmp-*`、`tmp-*.png`、`NVIDIA Corporation/`：本地工具或临时输出，已忽略，不属于项目内容。

## 验证

推荐检查：

```bash
godot --headless --path godot --import --quit
```

Godot 4.6 的 `--check-only` 需要配合 `--script` 使用，可逐个脚本校验。
