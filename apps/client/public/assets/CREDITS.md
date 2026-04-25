# Asset Credits

本项目所有外部资源均使用 **CC0 1.0 Universal**（公共领域贡献）许可证：无需署名、可商用、可修改。资源不随仓库提交，使用 `node apps/client/scripts/download-assets.mjs` 自动下载。

## 资源清单

资源全部来自 [Kenney](https://kenney.nl)，作者 Kenney Vleugels（CC0）。

### 角色精灵（sprites/）

| 文件 | 来源包 | 来源文件 |
| --- | --- | --- |
| `players.png` | [Pixel Platformer](https://kenney.nl/assets/pixel-platformer) | `Tilemap/tilemap-characters_packed.png` |
| `tiles_terrain.png` | [Pixel Platformer](https://kenney.nl/assets/pixel-platformer) | `Tilemap/tilemap_packed.png` |

`players.png` 是 9×3 格 24×24 角色表：第 0 行用作玩家 A，第 1 行用作玩家 B，每行包含 idle / walk / jump / hurt 等状态。

### 音乐（audio/music/）

| 文件 | 来源包 | 来源文件 |
| --- | --- | --- |
| `menu_loop.ogg` | [Music Jingles](https://kenney.nl/assets/music-jingles) | `Audio/8-Bit jingles/jingles_NES00.ogg` |
| `level_loop.ogg` | [Music Jingles](https://kenney.nl/assets/music-jingles) | `Audio/8-Bit jingles/jingles_NES03.ogg` |
| `victory_loop.ogg` | [Music Jingles](https://kenney.nl/assets/music-jingles) | `Audio/8-Bit jingles/jingles_NES10.ogg` |

### 音效（audio/sfx/）

| 文件 | 来源包 | 来源文件 |
| --- | --- | --- |
| `jump.ogg` | [Impact Sounds](https://kenney.nl/assets/impact-sounds) | `Audio/footstep_concrete_000.ogg` |
| `land.ogg` | [Impact Sounds](https://kenney.nl/assets/impact-sounds) | `Audio/impactPlate_heavy_001.ogg` |
| `death.ogg` | [Impact Sounds](https://kenney.nl/assets/impact-sounds) | `Audio/impactPlank_medium_004.ogg` |
| `button_press.ogg` | [Interface Sounds](https://kenney.nl/assets/interface-sounds) | `Audio/click_001.ogg` |
| `button_release.ogg` | [Interface Sounds](https://kenney.nl/assets/interface-sounds) | `Audio/click_002.ogg` |
| `interact.ogg` | [Interface Sounds](https://kenney.nl/assets/interface-sounds) | `Audio/select_002.ogg` |
| `door_open.ogg` | [Sci-Fi Sounds](https://kenney.nl/assets/sci-fi-sounds) | `Audio/doorOpen_001.ogg` |
| `door_close.ogg` | [Sci-Fi Sounds](https://kenney.nl/assets/sci-fi-sounds) | `Audio/doorClose_001.ogg` |
| `respawn.ogg` | [Sci-Fi Sounds](https://kenney.nl/assets/sci-fi-sounds) | `Audio/forceField_001.ogg` |
| `laser_hum.ogg` | [Sci-Fi Sounds](https://kenney.nl/assets/sci-fi-sounds) | `Audio/laserSmall_000.ogg` |
| `level_complete.ogg` | [Music Jingles](https://kenney.nl/assets/music-jingles) | `Audio/Pizzicato jingles/jingles_PIZZI00.ogg` |
| `game_complete.ogg` | [Music Jingles](https://kenney.nl/assets/music-jingles) | `Audio/Steel jingles/jingles_STEEL00.ogg` |

### 背景

未使用外部背景图，沿用程序化多层 parallax 背景（`apps/client/src/rendering/BackgroundRenderer.ts`）。Kenney 在 kenney.nl 没有合适的纯像素风 parallax 资源包，已确认 `background-elements-redux`、`platformer-art-pixel-redux` 等 slug 已下线/不存在。

## 缺失资源时的行为

资源全部 **可选**：

- 缺少 `players.png` → 玩家使用程序化生成的 48×48 角色精灵（`apps/client/src/rendering/TextureGenerator.ts`）。
- 缺少音乐 OGG → `MusicManager` 启动 Web Audio 程序化 chiptune 音序器。
- 缺少音效 OGG → `SfxManager` 用 Web Audio 合成对应音效。

`apps/client/src/assets/AssetRegistry.ts` 在 PreloadScene 中按 key 标记 present/missing，下游系统根据该状态自动选择走外部资源还是程序化兜底。

## 添加新资源时的规则

1. 必须 CC0 或同等无署名要求的许可证。
2. 在本文件中追加一行说明文件名、来源 URL、原始路径。
3. 如有需要在 `apps/client/scripts/download-assets.mjs` 的 `PACKS` 数组中追加下载条目。
4. 商业使用前请独立核对许可证条款，本项目不对资源许可作担保。
