# Asset Credits

本项目资源分为两类：项目定制美术/音乐资源随仓库提交；Kenney 地形/音效素材使用 **CC0 1.0 Universal**（公共领域贡献）许可证，可通过 `node apps/client/scripts/download-assets.mjs` 自动下载。

## 资源清单

### 项目定制美术

| 文件                  | 来源          | 说明                                                      |
| --------------------- | ------------- | --------------------------------------------------------- |
| `bg/lab_backdrop.png` | imagegen 生成 | 地下交通实验室像素风背景，用于 `ext_bg_backdrop`。        |
| `sprites/players.png` | 项目内生成    | 9×3 格 24×24 自定义角色表，第 0 行玩家 A，第 1 行玩家 B。 |
| `sprites/world/*.png` | 项目内生成    | 平台、按钮、门、陷阱、出口、墙体和粒子纹理。              |

### 项目定制音乐

| 文件                                   | 来源       | 说明                     |
| -------------------------------------- | ---------- | ------------------------ |
| `audio/music/menu_lab_drift.wav`       | 项目内生成 | 菜单低压实验室氛围循环。 |
| `audio/music/level_circuit_run.wav`    | 项目内生成 | 关卡推进节奏循环。       |
| `audio/music/victory_signal_clear.wav` | 项目内生成 | 通关明亮收束循环。       |

### Kenney CC0 资源

以下资源来自 [Kenney](https://kenney.nl)，作者 Kenney Vleugels（CC0）。

### 角色精灵（sprites/）

| 文件                | 来源包                                                        | 来源文件                     |
| ------------------- | ------------------------------------------------------------- | ---------------------------- |
| `tiles_terrain.png` | [Pixel Platformer](https://kenney.nl/assets/pixel-platformer) | `Tilemap/tilemap_packed.png` |

`players.png` 现在是项目定制角色表，不再由下载脚本覆盖。

### 音效（audio/sfx/）

| 文件                 | 来源包                                                        | 来源文件                                      |
| -------------------- | ------------------------------------------------------------- | --------------------------------------------- |
| `jump.ogg`           | [Impact Sounds](https://kenney.nl/assets/impact-sounds)       | `Audio/footstep_concrete_000.ogg`             |
| `land.ogg`           | [Impact Sounds](https://kenney.nl/assets/impact-sounds)       | `Audio/impactPlate_heavy_001.ogg`             |
| `death.ogg`          | [Impact Sounds](https://kenney.nl/assets/impact-sounds)       | `Audio/impactPlank_medium_004.ogg`            |
| `button_press.ogg`   | [Interface Sounds](https://kenney.nl/assets/interface-sounds) | `Audio/click_001.ogg`                         |
| `button_release.ogg` | [Interface Sounds](https://kenney.nl/assets/interface-sounds) | `Audio/click_002.ogg`                         |
| `interact.ogg`       | [Interface Sounds](https://kenney.nl/assets/interface-sounds) | `Audio/select_002.ogg`                        |
| `door_open.ogg`      | [Sci-Fi Sounds](https://kenney.nl/assets/sci-fi-sounds)       | `Audio/doorOpen_001.ogg`                      |
| `door_close.ogg`     | [Sci-Fi Sounds](https://kenney.nl/assets/sci-fi-sounds)       | `Audio/doorClose_001.ogg`                     |
| `respawn.ogg`        | [Sci-Fi Sounds](https://kenney.nl/assets/sci-fi-sounds)       | `Audio/forceField_001.ogg`                    |
| `laser_hum.ogg`      | [Sci-Fi Sounds](https://kenney.nl/assets/sci-fi-sounds)       | `Audio/laserSmall_000.ogg`                    |
| `level_complete.ogg` | [Music Jingles](https://kenney.nl/assets/music-jingles)       | `Audio/Pizzicato jingles/jingles_PIZZI00.ogg` |
| `game_complete.ogg`  | [Music Jingles](https://kenney.nl/assets/music-jingles)       | `Audio/Steel jingles/jingles_STEEL00.ogg`     |

### 背景

背景现在优先加载 `bg/lab_backdrop.png`；缺失时回退到程序化多层 parallax 背景（`apps/client/src/rendering/BackgroundRenderer.ts`）。

## 缺失资源时的行为

资源全部 **可选**：

- 缺少 `players.png` → 玩家使用程序化生成的 48×48 角色精灵（`apps/client/src/rendering/TextureGenerator.ts`）。
- 缺少 `bg/lab_backdrop.png` → 背景使用程序化渐变、远景和雾层。
- 缺少 `sprites/world/*.png` → 平台、机关、陷阱、出口等纹理由 `TextureGenerator.ts` 程序化生成。
- 缺少音乐 OGG → `MusicManager` 启动 Web Audio 程序化 chiptune 音序器。
- 缺少音效 OGG → `SfxManager` 用 Web Audio 合成对应音效。

`apps/client/src/assets/AssetRegistry.ts` 在 PreloadScene 中按 key 标记 present/missing，下游系统根据该状态自动选择走外部资源还是程序化兜底。

## 添加新资源时的规则

1. 必须 CC0 或同等无署名要求的许可证。
2. 在本文件中追加一行说明文件名、来源 URL、原始路径。
3. 如有需要在 `apps/client/scripts/download-assets.mjs` 的 `PACKS` 数组中追加下载条目。
4. 商业使用前请独立核对许可证条款，本项目不对资源许可作担保。
