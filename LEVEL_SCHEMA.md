# LEVEL_SCHEMA.md

## 目标

关卡使用 JSON 文件描述。服务端加载并校验关卡，客户端只用同一份数据做展示和静态预览。所有碰撞、机关和通关判定以服务端解析后的关卡数据为准。

MVP 约束：

- 坐标和尺寸统一使用世界单位，MVP 可直接等于像素。
- 实体优先使用矩形，避免复杂多边形碰撞。
- 每关固定 2 个玩家出生点。
- 每关至少 1 个出口。
- 按钮、门、陷阱、移动平台都必须有稳定 `id`。

## 文件命名

推荐：

```text
levels/
  level-001.json
  level-002.json
  ...
  level-010.json
```

`id` 必须与文件名主体一致，例如 `level-001.json` 内的 `id` 为 `level-001`。

## 顶层结构

```json
{
  "schemaVersion": 1,
  "id": "level-001",
  "name": "基础配合",
  "world": {},
  "players": [],
  "platforms": [],
  "buttons": [],
  "doors": [],
  "traps": [],
  "exits": []
}
```

## JSON Schema

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://example.local/schemas/level.schema.json",
  "title": "Coop Puzzle Level",
  "type": "object",
  "additionalProperties": false,
  "required": [
    "schemaVersion",
    "id",
    "name",
    "world",
    "players",
    "platforms",
    "buttons",
    "doors",
    "traps",
    "exits"
  ],
  "properties": {
    "schemaVersion": {
      "const": 1
    },
    "id": {
      "type": "string",
      "pattern": "^level-[0-9]{3}$"
    },
    "name": {
      "type": "string",
      "minLength": 1,
      "maxLength": 64
    },
    "world": {
      "$ref": "#/$defs/world"
    },
    "players": {
      "type": "array",
      "minItems": 2,
      "maxItems": 2,
      "items": {
        "$ref": "#/$defs/playerSpawn"
      }
    },
    "platforms": {
      "type": "array",
      "items": {
        "$ref": "#/$defs/platform"
      }
    },
    "buttons": {
      "type": "array",
      "items": {
        "$ref": "#/$defs/button"
      }
    },
    "doors": {
      "type": "array",
      "items": {
        "$ref": "#/$defs/door"
      }
    },
    "traps": {
      "type": "array",
      "items": {
        "$ref": "#/$defs/trap"
      }
    },
    "exits": {
      "type": "array",
      "minItems": 1,
      "items": {
        "$ref": "#/$defs/exit"
      }
    }
  },
  "$defs": {
    "world": {
      "type": "object",
      "additionalProperties": false,
      "required": ["width", "height", "gravity"],
      "properties": {
        "width": {
          "type": "number",
          "exclusiveMinimum": 0
        },
        "height": {
          "type": "number",
          "exclusiveMinimum": 0
        },
        "gravity": {
          "type": "number",
          "exclusiveMinimum": 0
        },
        "background": {
          "type": "string"
        }
      }
    },
    "rect": {
      "type": "object",
      "additionalProperties": false,
      "required": ["x", "y", "w", "h"],
      "properties": {
        "x": {
          "type": "number"
        },
        "y": {
          "type": "number"
        },
        "w": {
          "type": "number",
          "exclusiveMinimum": 0
        },
        "h": {
          "type": "number",
          "exclusiveMinimum": 0
        }
      }
    },
    "point": {
      "type": "object",
      "additionalProperties": false,
      "required": ["x", "y"],
      "properties": {
        "x": {
          "type": "number"
        },
        "y": {
          "type": "number"
        }
      }
    },
    "playerSpawn": {
      "type": "object",
      "additionalProperties": false,
      "required": ["playerIndex", "x", "y"],
      "properties": {
        "playerIndex": {
          "type": "integer",
          "minimum": 0,
          "maximum": 1
        },
        "x": {
          "type": "number"
        },
        "y": {
          "type": "number"
        },
        "facing": {
          "type": "integer",
          "enum": [-1, 1],
          "default": 1
        }
      }
    },
    "platform": {
      "type": "object",
      "additionalProperties": false,
      "required": ["id", "type", "rect"],
      "properties": {
        "id": {
          "type": "string"
        },
        "type": {
          "type": "string",
          "enum": ["solid", "oneWay", "moving"]
        },
        "rect": {
          "$ref": "#/$defs/rect"
        },
        "path": {
          "type": "array",
          "minItems": 2,
          "items": {
            "$ref": "#/$defs/point"
          }
        },
        "speed": {
          "type": "number",
          "exclusiveMinimum": 0
        },
        "activeByDefault": {
          "type": "boolean",
          "default": true
        }
      }
    },
    "button": {
      "type": "object",
      "additionalProperties": false,
      "required": ["id", "kind", "mode", "rect", "targets"],
      "properties": {
        "id": {
          "type": "string"
        },
        "kind": {
          "type": "string",
          "enum": ["pressure", "interact", "timed"]
        },
        "mode": {
          "type": "string",
          "enum": ["hold"]
        },
        "rect": {
          "$ref": "#/$defs/rect"
        },
        "holdMs": {
          "type": "integer",
          "minimum": 0,
          "default": 0
        },
        "cooldownMs": {
          "type": "integer",
          "minimum": 0,
          "default": 0
        },
        "targets": {
          "type": "array",
          "minItems": 1,
          "items": {
            "$ref": "#/$defs/targetAction"
          }
        }
      }
    },
    "targetAction": {
      "type": "object",
      "additionalProperties": false,
      "required": ["targetId", "action"],
      "properties": {
        "targetId": {
          "type": "string"
        },
        "action": {
          "type": "string",
          "enum": ["open", "close", "toggle", "enable", "disable", "start", "stop"]
        },
        "delayMs": {
          "type": "integer",
          "minimum": 0,
          "default": 0
        },
        "durationMs": {
          "type": "integer",
          "minimum": 0
        }
      }
    },
    "door": {
      "type": "object",
      "additionalProperties": false,
      "required": ["id", "rect", "startsOpen"],
      "properties": {
        "id": {
          "type": "string"
        },
        "rect": {
          "$ref": "#/$defs/rect"
        },
        "startsOpen": {
          "type": "boolean"
        },
        "openDurationMs": {
          "type": "integer",
          "minimum": 0,
          "default": 150
        },
        "colorKey": {
          "type": "string"
        }
      }
    },
    "trap": {
      "type": "object",
      "additionalProperties": false,
      "required": ["id", "type", "rect", "enabledByDefault"],
      "properties": {
        "id": {
          "type": "string"
        },
        "type": {
          "type": "string",
          "enum": ["spike", "laser", "crusher"]
        },
        "rect": {
          "$ref": "#/$defs/rect"
        },
        "enabledByDefault": {
          "type": "boolean"
        },
        "cycle": {
          "type": "object",
          "additionalProperties": false,
          "required": ["activeMs", "inactiveMs", "offsetMs"],
          "properties": {
            "activeMs": {
              "type": "integer",
              "minimum": 0
            },
            "inactiveMs": {
              "type": "integer",
              "minimum": 0
            },
            "offsetMs": {
              "type": "integer",
              "minimum": 0
            }
          }
        },
        "path": {
          "type": "array",
          "minItems": 2,
          "items": {
            "$ref": "#/$defs/point"
          }
        },
        "speed": {
          "type": "number",
          "exclusiveMinimum": 0
        }
      }
    },
    "exit": {
      "type": "object",
      "additionalProperties": false,
      "required": ["id", "rect", "requiresBothPlayers"],
      "properties": {
        "id": {
          "type": "string"
        },
        "rect": {
          "$ref": "#/$defs/rect"
        },
        "requiresBothPlayers": {
          "type": "boolean"
        },
        "holdMs": {
          "type": "integer",
          "minimum": 0,
          "default": 500
        }
      }
    }
  }
}
```

## 额外校验规则

JSON Schema 只能检查结构，加载器还必须检查：

- 所有 `id` 在同类实体中唯一。
- `players` 必须同时包含 `playerIndex = 0` 和 `playerIndex = 1`。
- `button.targets[].targetId` 必须引用存在的门、陷阱或移动平台。
- `platform.type = moving` 时必须提供 `path` 和 `speed`。
- `trap.type = crusher` 时必须提供 `path` 和 `speed`。
- `trap.type = laser` 使用周期时必须提供 `cycle`。
- 所有矩形必须在 `world.width` 和 `world.height` 范围内。
- 出生点不能与 solid 平台、关闭门或陷阱重叠。
- 至少有一个出口 `requiresBothPlayers = true`。

## 最小关卡示例

```json
{
  "schemaVersion": 1,
  "id": "level-001",
  "name": "基础配合",
  "world": {
    "width": 1280,
    "height": 720,
    "gravity": 1800,
    "background": "default"
  },
  "players": [
    {
      "playerIndex": 0,
      "x": 120,
      "y": 600,
      "facing": 1
    },
    {
      "playerIndex": 1,
      "x": 180,
      "y": 600,
      "facing": 1
    }
  ],
  "platforms": [
    {
      "id": "floor",
      "type": "solid",
      "rect": {
        "x": 0,
        "y": 680,
        "w": 1280,
        "h": 40
      }
    }
  ],
  "buttons": [
    {
      "id": "button-a",
      "kind": "pressure",
      "mode": "hold",
      "rect": {
        "x": 300,
        "y": 656,
        "w": 48,
        "h": 24
      },
      "targets": [
        {
          "targetId": "door-a",
          "action": "open"
        }
      ]
    }
  ],
  "doors": [
    {
      "id": "door-a",
      "rect": {
        "x": 600,
        "y": 560,
        "w": 40,
        "h": 120
      },
      "startsOpen": false,
      "openDurationMs": 150,
      "colorKey": "red"
    }
  ],
  "traps": [],
  "exits": [
    {
      "id": "exit-a",
      "rect": {
        "x": 1160,
        "y": 600,
        "w": 80,
        "h": 80
      },
      "requiresBothPlayers": true,
      "holdMs": 500
    }
  ]
}
```

## 独立验收任务

- L-01：实现关卡 JSON 读取和 schema 校验。
- L-02：实现额外引用校验和出生点安全校验。
- L-03：实现平台解析，支持 solid、oneWay、moving。
- L-04：实现按钮解析，支持 pressure、interact、timed。
- L-05：实现门解析和按钮目标动作。
- L-06：实现陷阱解析，支持 spike、laser、crusher。
- L-07：实现出口双人 hold 判定。
- L-08：制作并校验 `level-001.json` 到 `level-010.json`。
- L-09：实现关卡加载失败时的服务端错误消息。
- L-10：实现开发用关卡校验命令。
