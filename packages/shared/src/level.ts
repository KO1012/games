export type Rect = {
  x: number;
  y: number;
  w: number;
  h: number;
};

export type Point = {
  x: number;
  y: number;
};

export type LevelWorld = {
  width: number;
  height: number;
  gravity: number;
  background?: string;
};

export type PlayerSpawn = {
  playerIndex: 0 | 1;
  x: number;
  y: number;
  facing?: -1 | 1;
};

export type PlatformType = "solid" | "oneWay" | "moving";

export type PlatformDefinition = {
  id: string;
  type: PlatformType;
  rect: Rect;
  path?: Point[];
  speed?: number;
  activeByDefault?: boolean;
};

export type ButtonKind = "pressure" | "interact" | "timed";
export type ButtonMode = "hold";
export type TargetActionType = "open" | "close" | "toggle" | "enable" | "disable" | "start" | "stop";

export type TargetAction = {
  targetId: string;
  action: TargetActionType;
  delayMs?: number;
  durationMs?: number;
};

export type ButtonDefinition = {
  id: string;
  kind: ButtonKind;
  mode: ButtonMode;
  rect: Rect;
  holdMs?: number;
  cooldownMs?: number;
  targets: TargetAction[];
};

export type DoorDefinition = {
  id: string;
  rect: Rect;
  startsOpen: boolean;
  openDurationMs?: number;
  colorKey?: string;
};

export type TrapType = "spike" | "laser" | "crusher";

export type TrapCycle = {
  activeMs: number;
  inactiveMs: number;
  offsetMs: number;
};

export type TrapDefinition = {
  id: string;
  type: TrapType;
  rect: Rect;
  enabledByDefault: boolean;
  cycle?: TrapCycle;
  path?: Point[];
  speed?: number;
};

export type ExitDefinition = {
  id: string;
  rect: Rect;
  requiresBothPlayers: boolean;
  holdMs?: number;
};

export type LevelSchema = {
  schemaVersion: 1;
  id: string;
  name: string;
  world: LevelWorld;
  players: [PlayerSpawn, PlayerSpawn];
  platforms: PlatformDefinition[];
  buttons: ButtonDefinition[];
  doors: DoorDefinition[];
  traps: TrapDefinition[];
  exits: ExitDefinition[];
};

export type LevelDefinition = LevelSchema;

export const SUPPORTED_LEVEL_OBJECT_TYPES = [
  "solid",
  "oneWay",
  "moving",
  "spawn",
  "button",
  "door",
  "trap",
  "exit",
] as const;

export type SupportedLevelObjectType = (typeof SUPPORTED_LEVEL_OBJECT_TYPES)[number];

export type ActorRect = {
  id: string;
  rect: Rect;
};

export type ButtonStateSnapshot = {
  id: string;
  active: boolean;
  pressedBy: string[];
  cooldownUntil: number;
};

export type DoorStateSnapshot = {
  id: string;
  open: boolean;
  locked: boolean;
  progress: number;
};

export type TrapStateSnapshot = {
  id: string;
  enabled: boolean;
  active: boolean;
  x: number;
  y: number;
};

export type MovingPlatformStateSnapshot = {
  id: string;
  active: boolean;
  x: number;
  y: number;
};

export type LevelMechanicsState = {
  buttons: Record<string, ButtonStateSnapshot>;
  doors: Record<string, DoorStateSnapshot>;
  traps: Record<string, TrapStateSnapshot>;
  movingPlatforms: Record<string, MovingPlatformStateSnapshot>;
};

export type LevelValidationResult =
  | {
      ok: true;
      level: LevelSchema;
      errors: [];
    }
  | {
      ok: false;
      errors: string[];
    };

const levelKeys = [
  "schemaVersion",
  "id",
  "name",
  "world",
  "players",
  "platforms",
  "buttons",
  "doors",
  "traps",
  "exits",
] as const;
const worldKeys = ["width", "height", "gravity", "background"] as const;
const playerSpawnKeys = ["playerIndex", "x", "y", "facing"] as const;
const rectKeys = ["x", "y", "w", "h"] as const;
const pointKeys = ["x", "y"] as const;
const platformKeys = ["id", "type", "rect", "path", "speed", "activeByDefault"] as const;
const buttonKeys = ["id", "kind", "mode", "rect", "holdMs", "cooldownMs", "targets"] as const;
const targetActionKeys = ["targetId", "action", "delayMs", "durationMs"] as const;
const doorKeys = ["id", "rect", "startsOpen", "openDurationMs", "colorKey"] as const;
const trapKeys = ["id", "type", "rect", "enabledByDefault", "cycle", "path", "speed"] as const;
const trapCycleKeys = ["activeMs", "inactiveMs", "offsetMs"] as const;
const exitKeys = ["id", "rect", "requiresBothPlayers", "holdMs"] as const;

const platformTypes = new Set<PlatformType>(["solid", "oneWay", "moving"]);
const buttonKinds = new Set<ButtonKind>(["pressure", "interact", "timed"]);
const buttonModes = new Set<ButtonMode>(["hold"]);
const targetActions = new Set<TargetActionType>(["open", "close", "toggle", "enable", "disable", "start", "stop"]);
const trapTypes = new Set<TrapType>(["spike", "laser", "crusher"]);

export function validateLevelSchema(input: unknown): LevelValidationResult {
  const errors: string[] = [];

  if (!isRecord(input)) {
    return {
      ok: false,
      errors: ["level must be an object"],
    };
  }

  checkRequiredKeys(input, levelKeys, "level", errors);
  checkUnknownKeys(input, levelKeys, "level", errors);

  if (input.schemaVersion !== 1) {
    errors.push("level.schemaVersion must be 1");
  }

  if (typeof input.id !== "string" || !/^level-[0-9]{3}$/.test(input.id)) {
    errors.push("level.id must match ^level-[0-9]{3}$");
  }

  if (typeof input.name !== "string" || input.name.length < 1 || input.name.length > 64) {
    errors.push("level.name must be 1-64 characters");
  }

  const world = validateWorld(input.world, "level.world", errors);
  const players = validateArray(input.players, "level.players", errors)
    .map((item, index) => validatePlayerSpawn(item, `level.players[${index}]`, errors))
    .filter(isDefined);
  const platforms = validateArray(input.platforms, "level.platforms", errors)
    .map((item, index) => validatePlatform(item, `level.platforms[${index}]`, errors))
    .filter(isDefined);
  const buttons = validateArray(input.buttons, "level.buttons", errors)
    .map((item, index) => validateButton(item, `level.buttons[${index}]`, errors))
    .filter(isDefined);
  const doors = validateArray(input.doors, "level.doors", errors)
    .map((item, index) => validateDoor(item, `level.doors[${index}]`, errors))
    .filter(isDefined);
  const traps = validateArray(input.traps, "level.traps", errors)
    .map((item, index) => validateTrap(item, `level.traps[${index}]`, errors))
    .filter(isDefined);
  const exits = validateArray(input.exits, "level.exits", errors)
    .map((item, index) => validateExit(item, `level.exits[${index}]`, errors))
    .filter(isDefined);

  if (players.length !== 2) {
    errors.push("level.players must contain exactly 2 spawns");
  } else {
    const playerIndexes = new Set(players.map((player) => player.playerIndex));

    if (!playerIndexes.has(0) || !playerIndexes.has(1)) {
      errors.push("level.players must contain playerIndex 0 and 1");
    }
  }

  if (exits.length < 1) {
    errors.push("level.exits must contain at least 1 exit");
  }

  if (!exits.some((exit) => exit.requiresBothPlayers)) {
    errors.push("level.exits must contain at least one requiresBothPlayers exit");
  }

  validateUniqueIds(platforms, "level.platforms", errors);
  validateUniqueIds(buttons, "level.buttons", errors);
  validateUniqueIds(doors, "level.doors", errors);
  validateUniqueIds(traps, "level.traps", errors);
  validateUniqueIds(exits, "level.exits", errors);

  if (world) {
    validateRectsInsideWorld(platforms, "level.platforms", world, errors);
    validateRectsInsideWorld(buttons, "level.buttons", world, errors);
    validateRectsInsideWorld(doors, "level.doors", world, errors);
    validateRectsInsideWorld(traps, "level.traps", world, errors);
    validateRectsInsideWorld(exits, "level.exits", world, errors);
    validateSpawnsInsideWorld(players, world, errors);
    validateSpawnSafety(players, platforms, doors, traps, errors);
  }

  validateMovingPlatforms(platforms, errors);
  validateTraps(traps, errors);
  validateButtonTargets(buttons, platforms, doors, traps, errors);

  if (errors.length > 0) {
    return {
      ok: false,
      errors,
    };
  }

  return {
    ok: true,
    level: input as LevelSchema,
    errors: [],
  };
}

export function parseLevelSchema(input: unknown, source = "level"): LevelSchema {
  const result = validateLevelSchema(input);

  if (!result.ok) {
    throw new Error(`${source} is invalid:\n- ${result.errors.join("\n- ")}`);
  }

  return result.level;
}

export function resolveHoldButtonDoorState(level: LevelSchema, actors: readonly ActorRect[]): LevelMechanicsState {
  const buttons: Record<string, ButtonStateSnapshot> = {};
  const doors: Record<string, DoorStateSnapshot> = {};
  const activeOpenTargets = new Set<string>();
  const hasOpenControl = new Set<string>();
  const activeCloseTargets = new Set<string>();

  for (const button of level.buttons) {
    const pressedBy = actors.filter((actor) => rectsOverlap(actor.rect, button.rect)).map((actor) => actor.id);
    const active = button.mode === "hold" && pressedBy.length > 0;

    buttons[button.id] = {
      id: button.id,
      active,
      pressedBy,
      cooldownUntil: 0,
    };

    for (const target of button.targets) {
      if (target.action === "open") {
        hasOpenControl.add(target.targetId);

        if (active) {
          activeOpenTargets.add(target.targetId);
        }
      }

      if (target.action === "close" && active) {
        activeCloseTargets.add(target.targetId);
      }
    }
  }

  for (const door of level.doors) {
    const open = activeCloseTargets.has(door.id)
      ? false
      : hasOpenControl.has(door.id)
        ? activeOpenTargets.has(door.id)
        : door.startsOpen;

    doors[door.id] = {
      id: door.id,
      open,
      locked: false,
      progress: open ? 1 : 0,
    };
  }

  return {
    buttons,
    doors,
    traps: Object.fromEntries(
      level.traps.map((trap) => [
        trap.id,
        {
          id: trap.id,
          enabled: trap.enabledByDefault,
          active: trap.enabledByDefault,
          x: trap.rect.x,
          y: trap.rect.y,
        },
      ]),
    ),
    movingPlatforms: Object.fromEntries(
      level.platforms
        .filter((platform) => platform.type === "moving")
        .map((platform) => [
          platform.id,
          {
            id: platform.id,
            active: platform.activeByDefault ?? true,
            x: platform.rect.x,
            y: platform.rect.y,
          },
        ]),
    ),
  };
}

export function rectsOverlap(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function validateWorld(input: unknown, path: string, errors: string[]): LevelWorld | null {
  if (!isRecord(input)) {
    errors.push(`${path} must be an object`);
    return null;
  }

  checkRequiredKeys(input, ["width", "height", "gravity"], path, errors);
  checkUnknownKeys(input, worldKeys, path, errors);

  if (!isPositiveNumber(input.width)) {
    errors.push(`${path}.width must be a positive number`);
  }

  if (!isPositiveNumber(input.height)) {
    errors.push(`${path}.height must be a positive number`);
  }

  if (!isPositiveNumber(input.gravity)) {
    errors.push(`${path}.gravity must be a positive number`);
  }

  if (input.background !== undefined && typeof input.background !== "string") {
    errors.push(`${path}.background must be a string`);
  }

  return isPositiveNumber(input.width) && isPositiveNumber(input.height) && isPositiveNumber(input.gravity)
    ? (input as LevelWorld)
    : null;
}

function validatePlayerSpawn(input: unknown, path: string, errors: string[]): PlayerSpawn | null {
  if (!isRecord(input)) {
    errors.push(`${path} must be an object`);
    return null;
  }

  checkRequiredKeys(input, ["playerIndex", "x", "y"], path, errors);
  checkUnknownKeys(input, playerSpawnKeys, path, errors);

  if (input.playerIndex !== 0 && input.playerIndex !== 1) {
    errors.push(`${path}.playerIndex must be 0 or 1`);
  }

  if (!isFiniteNumber(input.x)) {
    errors.push(`${path}.x must be a number`);
  }

  if (!isFiniteNumber(input.y)) {
    errors.push(`${path}.y must be a number`);
  }

  if (input.facing !== undefined && input.facing !== -1 && input.facing !== 1) {
    errors.push(`${path}.facing must be -1 or 1`);
  }

  return input as PlayerSpawn;
}

function validatePlatform(input: unknown, path: string, errors: string[]): PlatformDefinition | null {
  if (!isRecord(input)) {
    errors.push(`${path} must be an object`);
    return null;
  }

  checkRequiredKeys(input, ["id", "type", "rect"], path, errors);
  checkUnknownKeys(input, platformKeys, path, errors);
  validateString(input.id, `${path}.id`, errors);

  if (!platformTypes.has(input.type as PlatformType)) {
    errors.push(`${path}.type must be solid, oneWay, or moving`);
  }

  validateRect(input.rect, `${path}.rect`, errors);
  validatePointArray(input.path, `${path}.path`, errors);
  validateOptionalPositiveNumber(input.speed, `${path}.speed`, errors);

  if (input.activeByDefault !== undefined && typeof input.activeByDefault !== "boolean") {
    errors.push(`${path}.activeByDefault must be a boolean`);
  }

  return input as PlatformDefinition;
}

function validateButton(input: unknown, path: string, errors: string[]): ButtonDefinition | null {
  if (!isRecord(input)) {
    errors.push(`${path} must be an object`);
    return null;
  }

  checkRequiredKeys(input, ["id", "kind", "mode", "rect", "targets"], path, errors);
  checkUnknownKeys(input, buttonKeys, path, errors);
  validateString(input.id, `${path}.id`, errors);

  if (!buttonKinds.has(input.kind as ButtonKind)) {
    errors.push(`${path}.kind must be pressure, interact, or timed`);
  }

  if (!buttonModes.has(input.mode as ButtonMode)) {
    errors.push(`${path}.mode must be hold`);
  }

  validateRect(input.rect, `${path}.rect`, errors);
  validateOptionalNonNegativeInteger(input.holdMs, `${path}.holdMs`, errors);
  validateOptionalNonNegativeInteger(input.cooldownMs, `${path}.cooldownMs`, errors);

  const targets = validateArray(input.targets, `${path}.targets`, errors);

  if (targets.length < 1) {
    errors.push(`${path}.targets must contain at least 1 target`);
  }

  for (const [index, target] of targets.entries()) {
    validateTargetAction(target, `${path}.targets[${index}]`, errors);
  }

  return input as ButtonDefinition;
}

function validateTargetAction(input: unknown, path: string, errors: string[]): TargetAction | null {
  if (!isRecord(input)) {
    errors.push(`${path} must be an object`);
    return null;
  }

  checkRequiredKeys(input, ["targetId", "action"], path, errors);
  checkUnknownKeys(input, targetActionKeys, path, errors);
  validateString(input.targetId, `${path}.targetId`, errors);

  if (!targetActions.has(input.action as TargetActionType)) {
    errors.push(`${path}.action is not supported`);
  }

  validateOptionalNonNegativeInteger(input.delayMs, `${path}.delayMs`, errors);
  validateOptionalNonNegativeInteger(input.durationMs, `${path}.durationMs`, errors);

  return input as TargetAction;
}

function validateDoor(input: unknown, path: string, errors: string[]): DoorDefinition | null {
  if (!isRecord(input)) {
    errors.push(`${path} must be an object`);
    return null;
  }

  checkRequiredKeys(input, ["id", "rect", "startsOpen"], path, errors);
  checkUnknownKeys(input, doorKeys, path, errors);
  validateString(input.id, `${path}.id`, errors);
  validateRect(input.rect, `${path}.rect`, errors);

  if (typeof input.startsOpen !== "boolean") {
    errors.push(`${path}.startsOpen must be a boolean`);
  }

  validateOptionalNonNegativeInteger(input.openDurationMs, `${path}.openDurationMs`, errors);

  if (input.colorKey !== undefined && typeof input.colorKey !== "string") {
    errors.push(`${path}.colorKey must be a string`);
  }

  return input as DoorDefinition;
}

function validateTrap(input: unknown, path: string, errors: string[]): TrapDefinition | null {
  if (!isRecord(input)) {
    errors.push(`${path} must be an object`);
    return null;
  }

  checkRequiredKeys(input, ["id", "type", "rect", "enabledByDefault"], path, errors);
  checkUnknownKeys(input, trapKeys, path, errors);
  validateString(input.id, `${path}.id`, errors);

  if (!trapTypes.has(input.type as TrapType)) {
    errors.push(`${path}.type must be spike, laser, or crusher`);
  }

  validateRect(input.rect, `${path}.rect`, errors);

  if (typeof input.enabledByDefault !== "boolean") {
    errors.push(`${path}.enabledByDefault must be a boolean`);
  }

  validateTrapCycle(input.cycle, `${path}.cycle`, errors);
  validatePointArray(input.path, `${path}.path`, errors);
  validateOptionalPositiveNumber(input.speed, `${path}.speed`, errors);

  return input as TrapDefinition;
}

function validateTrapCycle(input: unknown, path: string, errors: string[]): TrapCycle | null {
  if (input === undefined) {
    return null;
  }

  if (!isRecord(input)) {
    errors.push(`${path} must be an object`);
    return null;
  }

  checkRequiredKeys(input, trapCycleKeys, path, errors);
  checkUnknownKeys(input, trapCycleKeys, path, errors);
  validateNonNegativeInteger(input.activeMs, `${path}.activeMs`, errors);
  validateNonNegativeInteger(input.inactiveMs, `${path}.inactiveMs`, errors);
  validateNonNegativeInteger(input.offsetMs, `${path}.offsetMs`, errors);

  return input as TrapCycle;
}

function validateExit(input: unknown, path: string, errors: string[]): ExitDefinition | null {
  if (!isRecord(input)) {
    errors.push(`${path} must be an object`);
    return null;
  }

  checkRequiredKeys(input, ["id", "rect", "requiresBothPlayers"], path, errors);
  checkUnknownKeys(input, exitKeys, path, errors);
  validateString(input.id, `${path}.id`, errors);
  validateRect(input.rect, `${path}.rect`, errors);

  if (typeof input.requiresBothPlayers !== "boolean") {
    errors.push(`${path}.requiresBothPlayers must be a boolean`);
  }

  validateOptionalNonNegativeInteger(input.holdMs, `${path}.holdMs`, errors);

  return input as ExitDefinition;
}

function validateRect(input: unknown, path: string, errors: string[]): Rect | null {
  if (!isRecord(input)) {
    errors.push(`${path} must be an object`);
    return null;
  }

  checkRequiredKeys(input, rectKeys, path, errors);
  checkUnknownKeys(input, rectKeys, path, errors);

  if (!isFiniteNumber(input.x)) {
    errors.push(`${path}.x must be a number`);
  }

  if (!isFiniteNumber(input.y)) {
    errors.push(`${path}.y must be a number`);
  }

  if (!isPositiveNumber(input.w)) {
    errors.push(`${path}.w must be a positive number`);
  }

  if (!isPositiveNumber(input.h)) {
    errors.push(`${path}.h must be a positive number`);
  }

  return input as Rect;
}

function validatePoint(input: unknown, path: string, errors: string[]): Point | null {
  if (!isRecord(input)) {
    errors.push(`${path} must be an object`);
    return null;
  }

  checkRequiredKeys(input, pointKeys, path, errors);
  checkUnknownKeys(input, pointKeys, path, errors);

  if (!isFiniteNumber(input.x)) {
    errors.push(`${path}.x must be a number`);
  }

  if (!isFiniteNumber(input.y)) {
    errors.push(`${path}.y must be a number`);
  }

  return input as Point;
}

function validatePointArray(input: unknown, path: string, errors: string[]): Point[] {
  if (input === undefined) {
    return [];
  }

  const points = validateArray(input, path, errors);

  if (points.length > 0 && points.length < 2) {
    errors.push(`${path} must contain at least 2 points`);
  }

  return points.map((point, index) => validatePoint(point, `${path}[${index}]`, errors)).filter(isDefined);
}

function validateMovingPlatforms(platforms: PlatformDefinition[], errors: string[]): void {
  for (const platform of platforms) {
    if (platform.type === "moving" && (!platform.path || platform.path.length < 2 || !isPositiveNumber(platform.speed))) {
      errors.push(`moving platform ${platform.id} must provide path and speed`);
    }
  }
}

function validateTraps(traps: TrapDefinition[], errors: string[]): void {
  for (const trap of traps) {
    if (trap.type === "crusher" && (!trap.path || trap.path.length < 2 || !isPositiveNumber(trap.speed))) {
      errors.push(`crusher trap ${trap.id} must provide path and speed`);
    }

    if (trap.type === "laser" && trap.cycle === undefined) {
      errors.push(`laser trap ${trap.id} must provide cycle`);
    }
  }
}

function validateButtonTargets(
  buttons: ButtonDefinition[],
  platforms: PlatformDefinition[],
  doors: DoorDefinition[],
  traps: TrapDefinition[],
  errors: string[],
): void {
  const targetIds = new Set([
    ...doors.map((door) => door.id),
    ...traps.map((trap) => trap.id),
    ...platforms.filter((platform) => platform.type === "moving").map((platform) => platform.id),
  ]);

  for (const button of buttons) {
    for (const target of button.targets) {
      if (!targetIds.has(target.targetId)) {
        errors.push(`button ${button.id} targets unknown object ${target.targetId}`);
      }
    }
  }
}

function validateRectsInsideWorld<T extends { id: string; rect: Rect }>(
  entities: T[],
  path: string,
  world: LevelWorld,
  errors: string[],
): void {
  for (const entity of entities) {
    if (!isRectInsideWorld(entity.rect, world)) {
      errors.push(`${path}.${entity.id}.rect must be inside world bounds`);
    }
  }
}

function validateSpawnsInsideWorld(players: PlayerSpawn[], world: LevelWorld, errors: string[]): void {
  for (const player of players) {
    if (player.x < 0 || player.x > world.width || player.y < 0 || player.y > world.height) {
      errors.push(`player spawn ${player.playerIndex} must be inside world bounds`);
    }
  }
}

function validateSpawnSafety(
  players: PlayerSpawn[],
  platforms: PlatformDefinition[],
  doors: DoorDefinition[],
  traps: TrapDefinition[],
  errors: string[],
): void {
  const blockingRects = [
    ...platforms.filter((platform) => platform.type === "solid").map((platform) => platform.rect),
    ...doors.filter((door) => !door.startsOpen).map((door) => door.rect),
    ...traps.map((trap) => trap.rect),
  ];

  for (const player of players) {
    if (blockingRects.some((rect) => pointInsideRect(player, rect))) {
      errors.push(`player spawn ${player.playerIndex} overlaps a blocking object`);
    }
  }
}

function validateUniqueIds<T extends { id: string }>(entities: T[], path: string, errors: string[]): void {
  const ids = new Set<string>();

  for (const entity of entities) {
    if (ids.has(entity.id)) {
      errors.push(`${path} contains duplicate id ${entity.id}`);
    }

    ids.add(entity.id);
  }
}

function validateArray(input: unknown, path: string, errors: string[]): unknown[] {
  if (!Array.isArray(input)) {
    errors.push(`${path} must be an array`);
    return [];
  }

  return input;
}

function validateString(input: unknown, path: string, errors: string[]): void {
  if (typeof input !== "string" || input.length === 0) {
    errors.push(`${path} must be a non-empty string`);
  }
}

function validateOptionalPositiveNumber(input: unknown, path: string, errors: string[]): void {
  if (input !== undefined && !isPositiveNumber(input)) {
    errors.push(`${path} must be a positive number`);
  }
}

function validateOptionalNonNegativeInteger(input: unknown, path: string, errors: string[]): void {
  if (input !== undefined) {
    validateNonNegativeInteger(input, path, errors);
  }
}

function validateNonNegativeInteger(input: unknown, path: string, errors: string[]): void {
  if (!Number.isSafeInteger(input) || (input as number) < 0) {
    errors.push(`${path} must be a non-negative integer`);
  }
}

function checkRequiredKeys(input: Record<string, unknown>, keys: readonly string[], path: string, errors: string[]): void {
  for (const key of keys) {
    if (!(key in input)) {
      errors.push(`${path}.${key} is required`);
    }
  }
}

function checkUnknownKeys(input: Record<string, unknown>, keys: readonly string[], path: string, errors: string[]): void {
  const allowedKeys = new Set(keys);

  for (const key of Object.keys(input)) {
    if (!allowedKeys.has(key)) {
      errors.push(`${path}.${key} is not allowed`);
    }
  }
}

function isRectInsideWorld(rect: Rect, world: LevelWorld): boolean {
  return rect.x >= 0 && rect.y >= 0 && rect.x + rect.w <= world.width && rect.y + rect.h <= world.height;
}

function pointInsideRect(point: Point, rect: Rect): boolean {
  return point.x >= rect.x && point.x <= rect.x + rect.w && point.y >= rect.y && point.y <= rect.y + rect.h;
}

function isRecord(input: unknown): input is Record<string, unknown> {
  return typeof input === "object" && input !== null && !Array.isArray(input);
}

function isDefined<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

function isFiniteNumber(input: unknown): input is number {
  return typeof input === "number" && Number.isFinite(input);
}

function isPositiveNumber(input: unknown): input is number {
  return isFiniteNumber(input) && input > 0;
}
