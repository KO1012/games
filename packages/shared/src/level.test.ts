import { readdir, readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import {
  parseLevelSchema,
  resolveHoldButtonDoorState,
  validateLevelSchema,
  type LevelSchema,
} from "./index.js";

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

    const levels: LevelSchema[] = [];

    for (const fileName of levelFiles) {
      const rawLevel = JSON.parse(
        await readFile(new URL(fileName, levelsDirectory), "utf8"),
      ) as unknown;
      const level = parseLevelSchema(rawLevel, fileName);

      expect(level.id).toBe(fileName.replace(".json", ""));
      expect(level.metadata?.title).toBeTruthy();
      expect(level.metadata?.mechanicTags.length).toBeGreaterThan(0);
      levels.push(level);
    }

    // The redesigned 10-level set must collectively exercise every mechanic
    // the runtime supports, so future regressions show up at validation time.
    const hasMovingPlatform = levels.some((level) =>
      level.platforms.some((platform) => platform.type === "moving"),
    );
    const hasTimedButton = levels.some((level) =>
      level.buttons.some((button) => button.kind === "timed"),
    );
    const hasInteractButton = levels.some((level) =>
      level.buttons.some((button) => button.kind === "interact"),
    );
    const hasToggleButton = levels.some((level) =>
      level.buttons.some((button) => button.mode === "toggle"),
    );
    const hasDelayedTarget = levels.some((level) =>
      level.buttons.some((button) =>
        button.targets.some((target) => (target.delayMs ?? 0) > 0),
      ),
    );
    const hasLaserCycle = levels.some((level) =>
      level.traps.some((trap) => trap.type === "laser" && (trap.cycle?.inactiveMs ?? 0) > 0),
    );
    const hasCrusher = levels.some((level) => level.traps.some((trap) => trap.type === "crusher"));
    const hasSpike = levels.some((level) => level.traps.some((trap) => trap.type === "spike"));
    const hasWideWorld = levels.some((level) => level.world.width > 1280);

    expect(hasMovingPlatform).toBe(true);
    expect(hasTimedButton).toBe(true);
    expect(hasInteractButton).toBe(true);
    expect(hasToggleButton).toBe(true);
    expect(hasDelayedTarget).toBe(true);
    expect(hasLaserCycle).toBe(true);
    expect(hasCrusher).toBe(true);
    expect(hasSpike).toBe(true);
    expect(hasWideWorld).toBe(true);
  });

  it("validates the debug input level JSON file", async () => {
    const fileName = "level-debug-input.json";
    const rawLevel = JSON.parse(
      await readFile(new URL(fileName, levelsDirectory), "utf8"),
    ) as unknown;
    const level = parseLevelSchema(rawLevel, fileName);

    expect(level.id).toBe("level-debug-input");
  });

  it("keeps the final level as a multi-room gauntlet", async () => {
    const level = await loadBundledLevel("level-010.json");

    expect(level.world.width).toBeGreaterThan(1280);
    // Final level should still gate the exit on a requiresBothPlayers door.
    const finalExits = level.exits.filter((exit) => exit.requiresBothPlayers);
    expect(finalExits.length).toBeGreaterThanOrEqual(1);
    // Combine all the redesigned mechanics in the final relay.
    expect(level.platforms.some((platform) => platform.type === "moving")).toBe(true);
    expect(level.traps.some((trap) => trap.type === "laser")).toBe(true);
    expect(level.traps.some((trap) => trap.type === "crusher")).toBe(true);
    expect(level.buttons.some((button) => button.mode === "toggle")).toBe(true);
  });

  it("rejects invalid level metadata", () => {
    const invalidLevel: LevelSchema = {
      ...createTestLevel(),
      metadata: {
        title: "",
        difficulty: 0,
        introText: "Use the controls.",
        hintText: "Try the button.",
        mechanicTags: ["Pressure"],
        parTimeMs: 0,
      },
    };

    const result = validateLevelSchema(invalidLevel);

    expect(result.ok).toBe(false);
    expect(result.errors).toContain("level.metadata.title must be 1-64 characters");
    expect(result.errors).toContain("level.metadata.difficulty must be at least 1");
    expect(result.errors).toContain("level.metadata.mechanicTags[0] must be a lowercase tag");
    expect(result.errors).toContain("level.metadata.parTimeMs must be at least 1000");
  });

  it("accepts toggle-mode buttons with delayed targets", () => {
    const baseline = createTestLevel();
    const validLevel: LevelSchema = {
      ...baseline,
      buttons: [
        {
          id: "button-toggle",
          kind: "pressure",
          mode: "toggle",
          rect: { x: 120, y: 120, w: 40, h: 40 },
          cooldownMs: 250,
          targets: [{ targetId: "door-a", action: "open", delayMs: 800 }],
        },
      ],
    };

    const result = validateLevelSchema(validLevel);

    expect(result.ok).toBe(true);
  });

  it("rejects unknown button modes", () => {
    const baseline = createTestLevel();
    const invalidLevel = {
      ...baseline,
      buttons: [
        {
          ...baseline.buttons[0],
          mode: "latched",
        },
      ],
    } as unknown as LevelSchema;

    const result = validateLevelSchema(invalidLevel);

    expect(result.ok).toBe(false);
    expect(result.errors).toContain("level.buttons[0].mode must be hold or toggle");
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

  it("rejects spawns whose full player rectangle overlaps blocking objects", () => {
    const invalidLevel: LevelSchema = {
      ...createTestLevel(),
      platforms: [
        ...createTestLevel().platforms,
        {
          id: "spawn-overlap",
          type: "solid",
          rect: { x: 80, y: 40, w: 24, h: 24 },
        },
      ],
    };

    const result = validateLevelSchema(invalidLevel);

    expect(result.ok).toBe(false);
    expect(result.errors).toContain("player spawn 0 overlaps a blocking object");
  });
});

describe("hold button door logic", () => {
  it("opens the target door while a player overlaps the button", () => {
    const level = createTestLevel();
    const state = resolveHoldButtonDoorState(level, [
      { id: "A", rect: { x: 120, y: 120, w: 48, h: 48 } },
    ]);

    expect(state.buttons["button-a"]).toMatchObject({
      active: true,
      pressedBy: ["A"],
    });
    expect(state.doors["door-a"]?.open).toBe(true);
  });

  it("closes the target door when no player holds the button", () => {
    const level = createTestLevel();
    const state = resolveHoldButtonDoorState(level, [
      { id: "A", rect: { x: 20, y: 20, w: 48, h: 48 } },
    ]);

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

async function loadBundledLevel(fileName: string): Promise<LevelSchema> {
  return parseLevelSchema(
    JSON.parse(await readFile(new URL(fileName, levelsDirectory), "utf8")) as unknown,
    fileName,
  );
}

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
