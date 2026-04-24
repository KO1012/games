import { readdir, readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import { parseLevelSchema, resolveHoldButtonDoorState, validateLevelSchema, type LevelSchema } from "./index.js";

const levelsDirectory = new URL("../../../levels/", import.meta.url);

describe("level schema", () => {
  it("validates bundled level JSON files", async () => {
    const levelFiles = (await readdir(levelsDirectory))
      .filter((fileName) => /^level-[0-9]{3}\.json$/.test(fileName))
      .sort();

    expect(levelFiles).toEqual([
      "level-001.json",
      "level-002.json",
      "level-003.json",
      "level-004.json",
      "level-005.json",
      "level-006.json",
      "level-007.json",
      "level-008.json",
      "level-009.json",
      "level-010.json",
    ]);

    for (const fileName of levelFiles) {
      const rawLevel = JSON.parse(await readFile(new URL(fileName, levelsDirectory), "utf8")) as unknown;
      const level = parseLevelSchema(rawLevel, fileName);

      expect(level.id).toBe(fileName.replace(".json", ""));
    }
  });

  it("rejects invalid button targets", () => {
    const invalidLevel: LevelSchema = {
      ...createTestLevel(),
      buttons: [
        {
          id: "button-a",
          kind: "pressure",
          mode: "hold",
          rect: { x: 120, y: 120, w: 40, h: 40 },
          targets: [{ targetId: "missing-door", action: "open" }],
        },
      ],
    };

    const result = validateLevelSchema(invalidLevel);

    expect(result.ok).toBe(false);
    expect(result.errors).toContain("button button-a targets unknown object missing-door");
  });
});

describe("hold button door logic", () => {
  it("opens the target door while a player overlaps the button", () => {
    const level = createTestLevel();
    const state = resolveHoldButtonDoorState(level, [{ id: "A", rect: { x: 120, y: 120, w: 48, h: 48 } }]);

    expect(state.buttons["button-a"]).toMatchObject({
      active: true,
      pressedBy: ["A"],
    });
    expect(state.doors["door-a"]?.open).toBe(true);
  });

  it("closes the target door when no player holds the button", () => {
    const level = createTestLevel();
    const state = resolveHoldButtonDoorState(level, [{ id: "A", rect: { x: 20, y: 20, w: 48, h: 48 } }]);

    expect(state.buttons["button-a"]?.active).toBe(false);
    expect(state.doors["door-a"]?.open).toBe(false);
  });

  it("returns baseline trap and moving platform snapshots", () => {
    const level: LevelSchema = {
      ...createTestLevel(),
      platforms: [
        ...createTestLevel().platforms,
        {
          id: "platform-a",
          type: "moving",
          rect: { x: 200, y: 180, w: 80, h: 24 },
          path: [
            { x: 200, y: 180 },
            { x: 360, y: 180 },
          ],
          speed: 80,
          activeByDefault: false,
        },
      ],
      traps: [
        {
          id: "spike-a",
          type: "spike",
          rect: { x: 420, y: 180, w: 40, h: 40 },
          enabledByDefault: true,
        },
      ],
    };
    const state = resolveHoldButtonDoorState(level, []);

    expect(state.traps["spike-a"]).toMatchObject({
      active: true,
      enabled: true,
      x: 420,
      y: 180,
    });
    expect(state.movingPlatforms["platform-a"]).toMatchObject({
      active: false,
      x: 200,
      y: 180,
    });
  });
});

function createTestLevel(): LevelSchema {
  return {
    schemaVersion: 1,
    id: "level-999",
    name: "Test Level",
    world: {
      width: 640,
      height: 360,
      gravity: 1800,
      background: "test",
    },
    players: [
      {
        playerIndex: 0,
        x: 40,
        y: 40,
        facing: 1,
      },
      {
        playerIndex: 1,
        x: 90,
        y: 40,
        facing: 1,
      },
    ],
    platforms: [
      {
        id: "wall-top",
        type: "solid",
        rect: {
          x: 0,
          y: 0,
          w: 640,
          h: 16,
        },
      },
    ],
    buttons: [
      {
        id: "button-a",
        kind: "pressure",
        mode: "hold",
        rect: {
          x: 120,
          y: 120,
          w: 40,
          h: 40,
        },
        targets: [
          {
            targetId: "door-a",
            action: "open",
          },
        ],
      },
    ],
    doors: [
      {
        id: "door-a",
        rect: {
          x: 300,
          y: 80,
          w: 32,
          h: 120,
        },
        startsOpen: false,
        openDurationMs: 150,
        colorKey: "red",
      },
    ],
    traps: [],
    exits: [
      {
        id: "exit-a",
        rect: {
          x: 540,
          y: 120,
          w: 60,
          h: 80,
        },
        requiresBothPlayers: true,
        holdMs: 500,
      },
    ],
  };
}
