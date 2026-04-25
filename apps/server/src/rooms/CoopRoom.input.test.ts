import { describe, expect, it } from "vitest";
import {
  PLAYER_ROLES,
  PLAYER_SIZE,
  PLAYER_SPEED,
  ROOM_PHASES,
  type DoorStateSnapshot,
  type InputMessage,
  type LevelSchema,
  type PlayerSnapshot,
} from "@coop-game/shared";

import { CoopRoom } from "./CoopRoom.js";

type TestPlayer = PlayerSnapshot & {
  inputQueue: InputMessage[];
  lastInput: InputMessage | null;
  lastInputAt: number;
  interactQueued: boolean;
  interactQueuedUntil: number;
  jumpQueued: boolean;
  directionPulseTicks: {
    left: number;
    right: number;
    up: number;
    down: number;
  };
  horizontalIntent: -1 | 0 | 1;
  verticalIntent: -1 | 0 | 1;
};

type TestClient = {
  sessionId: string;
};

type TestRoom = {
  phase: string;
  currentLevel: LevelSchema | null;
  doors: Record<string, DoorStateSnapshot>;
  playersBySessionId: Map<string, TestPlayer>;
  handleInput: (client: TestClient, message: InputMessage) => void;
  applyQueuedPlayerInputs: (deltaSeconds: number, now: number) => void;
  applyPlatformerInput: (player: TestPlayer, input: InputMessage, deltaSeconds: number) => void;
  findHorizontalCollision: (player: TestPlayer) => ({ id?: string } | null);
  updateLevelMechanics: (now: number) => void;
};

function makeInput(seq: number, patch: Partial<InputMessage> = {}): InputMessage {
  return {
    type: "input",
    seq,
    clientTime: seq,
    left: false,
    right: false,
    up: false,
    down: false,
    jump: false,
    jumpPressed: false,
    interactPressed: false,
    ...patch,
  };
}

function makePlayer(overrides: Partial<TestPlayer> = {}): TestPlayer {
  return {
    sessionId: "session-a",
    playerIndex: 0,
    role: PLAYER_ROLES.A,
    name: "Alice",
    connected: true,
    ready: true,
    x: 160,
    y: 608,
    vx: 0,
    vy: 0,
    facing: 1,
    grounded: true,
    alive: true,
    respawnAt: 0,
    lastProcessedInputSeq: 0,
    inputQueue: [],
    lastInput: null,
    lastInputAt: 0,
    interactQueued: false,
    interactQueuedUntil: 0,
    jumpQueued: false,
    directionPulseTicks: {
      left: 0,
      right: 0,
      up: 0,
      down: 0,
    },
    horizontalIntent: 0,
    verticalIntent: 0,
    ...overrides,
  };
}

function consume(player: TestPlayer): InputMessage {
  const room = new CoopRoom() as unknown as {
    consumePlayerInputsForTick: (player: TestPlayer) => InputMessage;
  };
  return room.consumePlayerInputsForTick(player) as InputMessage;
}

function expectNoOppositeDirections(input: InputMessage): void {
  expect(input.left && input.right).toBe(false);
  expect(input.up && input.down).toBe(false);
}

function createRoomWithLevel(level: LevelSchema, player: TestPlayer): TestRoom {
  const room = new CoopRoom() as unknown as TestRoom;

  room.phase = ROOM_PHASES.playing;
  room.currentLevel = level;
  room.doors = Object.fromEntries(
    level.doors.map((door) => [
      door.id,
      {
        id: door.id,
        open: door.startsOpen,
        locked: false,
        progress: door.startsOpen ? 1 : 0,
      },
    ]),
  );
  room.playersBySessionId.clear();
  room.playersBySessionId.set(player.sessionId, player);

  return room;
}

type PhysicsEvent = {
  input: InputMessage;
  previousX: number;
  attemptedX: number;
  finalX: number;
  blocked: boolean;
  collisionId: string | null;
};

function capturePhysicsEvents(room: TestRoom): PhysicsEvent[] {
  const originalApplyPlatformerInput = room.applyPlatformerInput.bind(room);
  const events: PhysicsEvent[] = [];

  room.applyPlatformerInput = (player, input, deltaSeconds) => {
    const previousX = player.x;
    const worldWidth = room.currentLevel?.world.width ?? 1280;
    const axisX = Number(input.right) - Number(input.left);
    const attemptedX = Math.min(Math.max(player.x + axisX * PLAYER_SPEED * deltaSeconds, 0), worldWidth - PLAYER_SIZE);
    const originalX = player.x;

    player.x = attemptedX;
    const collision = room.findHorizontalCollision(player);
    player.x = originalX;

    originalApplyPlatformerInput(player, input, deltaSeconds);

    events.push({
      input,
      previousX,
      attemptedX,
      finalX: player.x,
      blocked: collision !== null,
      collisionId: collision?.id ?? null,
    });
  };

  return events;
}

function createOpenFieldLevel(): LevelSchema {
  return {
    schemaVersion: 1,
    id: "level-debug-input",
    name: "Input Debug Open Field",
    world: {
      width: 1280,
      height: 720,
      gravity: 1800,
      background: "platformer",
    },
    players: [
      { playerIndex: 0, x: 160, y: 608, facing: 1 },
      { playerIndex: 1, x: 260, y: 608, facing: 1 },
    ],
    platforms: [
      { id: "wall-left", type: "solid", rect: { x: 0, y: 0, w: 24, h: 720 } },
      { id: "wall-right", type: "solid", rect: { x: 1256, y: 0, w: 24, h: 720 } },
      { id: "floor-main", type: "solid", rect: { x: 0, y: 656, w: 1280, h: 64 } },
    ],
    buttons: [],
    doors: [],
    traps: [],
    exits: [{ id: "exit-debug", rect: { x: 1160, y: 560, w: 72, h: 96 }, requiresBothPlayers: false, holdMs: 500 }],
  };
}

function createClosedDoorLevel(): LevelSchema {
  return {
    schemaVersion: 1,
    id: "level-999",
    name: "Closed Door Test",
    world: {
      width: 640,
      height: 720,
      gravity: 1800,
      background: "test",
    },
    players: [
      { playerIndex: 0, x: 168, y: 608, facing: 1 },
      { playerIndex: 1, x: 80, y: 608, facing: 1 },
    ],
    platforms: [
      { id: "floor-main", type: "solid", rect: { x: 0, y: 656, w: 640, h: 64 } },
    ],
    buttons: [],
    doors: [{ id: "door-a", rect: { x: 220, y: 560, w: 32, h: 96 }, startsOpen: false }],
    traps: [],
    exits: [],
  };
}

function createInteractDoorLevel(): LevelSchema {
  return {
    schemaVersion: 1,
    id: "level-interact-door",
    name: "Interact Door Test",
    world: {
      width: 640,
      height: 720,
      gravity: 1800,
      background: "test",
    },
    players: [
      { playerIndex: 0, x: 160, y: 608, facing: 1 },
      { playerIndex: 1, x: 80, y: 608, facing: 1 },
    ],
    platforms: [{ id: "floor-main", type: "solid", rect: { x: 0, y: 656, w: 640, h: 64 } }],
    buttons: [
      {
        id: "button-a",
        kind: "interact",
        mode: "hold",
        rect: { x: 300, y: 608, w: 48, h: 48 },
        holdMs: 500,
        targets: [{ targetId: "door-a", action: "open" }],
      },
    ],
    doors: [{ id: "door-a", rect: { x: 420, y: 560, w: 32, h: 96 }, startsOpen: false }],
    traps: [],
    exits: [],
  };
}

describe("CoopRoom direction input conflict resolution", () => {
  it("keeps the latest horizontal direction when opposite directions happen in one tick", () => {
    const player = makePlayer({
      inputQueue: [makeInput(1, { left: true }), makeInput(2), makeInput(3, { right: true }), makeInput(4)],
    });

    const output = consume(player);

    expectNoOppositeDirections(output);
    expect(output.left).toBe(false);
    expect(output.right).toBe(true);
    expect(Number(output.right) - Number(output.left)).toBe(1);
  });

  it("keeps latest intent across an empty tick when both keys are still held", () => {
    const player = makePlayer({
      lastInput: makeInput(10, { left: true }),
      horizontalIntent: -1,
      inputQueue: [makeInput(11, { left: true, right: true })],
    });

    const firstOutput = consume(player);

    expectNoOppositeDirections(firstOutput);
    expect(firstOutput.left).toBe(false);
    expect(firstOutput.right).toBe(true);
    expect(player.horizontalIntent).toBe(1);

    const secondOutput = consume(player);

    expectNoOppositeDirections(secondOutput);
    expect(secondOutput.left).toBe(false);
    expect(secondOutput.right).toBe(true);
  });

  it("restores the opposite held direction when the latest direction is released", () => {
    const player = makePlayer({
      lastInput: makeInput(10, { left: true, right: true }),
      horizontalIntent: 1,
      directionPulseTicks: {
        left: 0,
        right: 3,
        up: 0,
        down: 0,
      },
      inputQueue: [makeInput(11, { left: true, right: false })],
    });

    const output = consume(player);

    expectNoOppositeDirections(output);
    expect(output.left).toBe(true);
    expect(output.right).toBe(false);
    expect(player.horizontalIntent).toBe(-1);
    expect(player.directionPulseTicks.right).toBe(0);
  });

  it("keeps a short same-tick tap visible through direction pulses", () => {
    const player = makePlayer({
      inputQueue: [makeInput(1, { right: true }), makeInput(2, { right: false })],
    });

    const output = consume(player);

    expectNoOppositeDirections(output);
    expect(output.left).toBe(false);
    expect(output.right).toBe(true);
    expect(Number(output.right) - Number(output.left)).toBe(1);
  });

  it("uses a late old press only as a pulse without replacing the released held snapshot", () => {
    const player = makePlayer({
      lastInput: makeInput(2, { right: false }),
      inputQueue: [makeInput(1, { right: true })],
    });

    const firstOutput = consume(player);

    expectNoOppositeDirections(firstOutput);
    expect(firstOutput.right).toBe(true);
    expect(player.lastInput).toMatchObject({ seq: 2, right: false });

    consume(player);
    consume(player);
    consume(player);
    const afterPulse = consume(player);

    expectNoOppositeDirections(afterPulse);
    expect(afterPulse.right).toBe(false);
  });

  it("does not let a stale opposite pulse override the current held intent", () => {
    const player = makePlayer({
      lastInput: makeInput(10, { right: true }),
      horizontalIntent: 1,
      inputQueue: [makeInput(9, { left: true })],
    });

    const output = consume(player);

    expectNoOppositeDirections(output);
    expect(output.left).toBe(false);
    expect(output.right).toBe(true);
    expect(player.horizontalIntent).toBe(1);
    expect(player.lastInput).toMatchObject({ seq: 10, right: true });
  });

  it("keeps the latest vertical direction when opposite vertical directions happen in one tick", () => {
    const player = makePlayer({
      inputQueue: [makeInput(1, { up: true }), makeInput(2), makeInput(3, { down: true }), makeInput(4)],
    });

    const output = consume(player);

    expectNoOppositeDirections(output);
    expect(output.up).toBe(false);
    expect(output.down).toBe(true);
    expect(Number(output.down) - Number(output.up)).toBe(1);
  });

  it("never returns both left and right as true even with overlapping snapshots", () => {
    const player = makePlayer({
      inputQueue: [makeInput(1, { left: true }), makeInput(2, { left: true, right: true })],
    });

    const output = consume(player);

    expectNoOppositeDirections(output);
  });

  it("keeps moving right for 60 ticks in the debug open field", () => {
    const player = makePlayer({ x: 160, y: 608 });
    const room = createRoomWithLevel(createOpenFieldLevel(), player);
    const physicsEvents = capturePhysicsEvents(room);
    const client = { sessionId: player.sessionId };
    const deltaSeconds = 1 / 60;

    for (let tick = 1; tick <= 60; tick += 1) {
      const previousX = player.x;

      room.handleInput(client, makeInput(tick, { right: true }));
      room.applyQueuedPlayerInputs(deltaSeconds, Date.now());

      const event = physicsEvents.at(-1);

      expect(event).toBeDefined();
      expect(event?.input.right).toBe(true);
      expect(event?.input.left).toBe(false);
      expect(event?.blocked).toBe(false);
      expect(event?.finalX).toBeGreaterThan(previousX);
    }

    expect(player.x).toBeGreaterThan(300);
  });

  it("reports a closed door collision and lets the player move away", () => {
    const player = makePlayer({ x: 168, y: 608 });
    const room = createRoomWithLevel(createClosedDoorLevel(), player);
    const physicsEvents = capturePhysicsEvents(room);
    const client = { sessionId: player.sessionId };
    const deltaSeconds = 1 / 60;
    const beforeBlockedMove = player.x;

    room.handleInput(client, makeInput(1, { right: true }));
    room.applyQueuedPlayerInputs(deltaSeconds, Date.now());

    const blockedEvent = physicsEvents.at(-1);

    expect(blockedEvent).toMatchObject({
      blocked: true,
      collisionId: "door-a",
      finalX: beforeBlockedMove,
    });
    expect(player.x).toBe(beforeBlockedMove);

    room.handleInput(client, makeInput(2, { left: true }));
    room.applyQueuedPlayerInputs(deltaSeconds, Date.now());

    const escapeEvent = physicsEvents.at(-1);

    expect(escapeEvent).toMatchObject({
      blocked: false,
      collisionId: null,
    });
    expect(player.x).toBeLessThan(beforeBlockedMove);
  });

  it("expires interact presses that were not consumed near a button", () => {
    const player = makePlayer({ x: 160, y: 608 });
    const room = createRoomWithLevel(createInteractDoorLevel(), player);
    const client = { sessionId: player.sessionId };

    room.handleInput(client, makeInput(1, { interactPressed: true }));
    player.x = 300;
    room.updateLevelMechanics(Date.now() + 1000);

    expect(room.doors["door-a"]?.open).toBe(false);

    room.handleInput(client, makeInput(2, { interactPressed: true }));
    room.updateLevelMechanics(Date.now());

    expect(room.doors["door-a"]?.open).toBe(true);
  });
});
