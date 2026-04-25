import {
  PROTOCOL_VERSION,
  ROOM_PHASES,
  type ButtonStateSnapshot,
  type DoorStateSnapshot,
  type LevelSchema,
  type RoomStateMessage,
} from "@coop-game/shared";
import { describe, expect, it } from "vitest";

import { CoopRoom } from "./CoopRoom.js";

type CoopClient = Parameters<CoopRoom["onJoin"]>[0];
type MessageHandler = (client: CoopClient, message: unknown) => unknown;

type SentMessage = {
  type: string | number;
  message: unknown;
};

type PendingReconnection = {
  resolve: (client: CoopClient) => void;
  reject: (error?: unknown) => void;
};

type TestClient = CoopClient & {
  sent: SentMessage[];
  errors: { code: number; message: string }[];
  left: boolean;
};

type Harness = {
  room: CoopRoom;
  broadcasts: SentMessage[];
  metadata: Record<string, unknown>;
  getSnapshot: () => RoomStateMessage;
  isLocked: () => boolean;
  resolveReconnection: (sessionId: string, client: CoopClient) => void;
  rejectReconnection: (sessionId: string) => void;
  receive: (type: string, client: CoopClient, message: unknown) => Promise<void>;
  step: (deltaMs: number) => void;
};

describe("CoopRoom", () => {
  it("creates a room with the first level loaded", async () => {
    const harness = await createHarness();
    const snapshot = harness.getSnapshot();

    expect(snapshot.phase).toBe(ROOM_PHASES.waiting);
    expect(snapshot.roomCode).toHaveLength(4);
    expect(snapshot.levelId).toBe("level-001");
    expect(snapshot.levelIndex).toBe(0);
  });

  it("allows two players to join", async () => {
    const harness = await createHarness();
    const firstClient = createClient("session-a");
    const secondClient = createClient("session-b");

    await join(harness.room, firstClient, "Alice");
    await join(harness.room, secondClient, "Bob");

    const snapshot = harness.getSnapshot();

    expect(firstClient.sent[0]).toMatchObject({ type: "room_joined", message: { role: "A", playerIndex: 0 } });
    expect(secondClient.sent[0]).toMatchObject({ type: "room_joined", message: { role: "B", playerIndex: 1 } });
    expect(snapshot.phase).toBe(ROOM_PHASES.readyCheck);
    expect(snapshot.players.A?.name).toBe("Alice");
    expect(snapshot.players.B?.name).toBe("Bob");
    expect(harness.isLocked()).toBe(true);
  });

  it("lets the first player move during one-player warmup", async () => {
    const harness = await createHarness();
    const firstClient = createClient("session-a");

    await join(harness.room, firstClient, "Alice");

    const beforeInput = harness.getSnapshot().players.A;

    await harness.receive("input", firstClient, {
      type: "input",
      seq: 1,
      clientTime: Date.now(),
      left: false,
      right: true,
      up: false,
      down: false,
      jump: false,
      jumpPressed: false,
      interactPressed: false,
    });
    harness.step(100);

    const afterInput = harness.getSnapshot().players.A;

    expect(harness.getSnapshot().phase).toBe(ROOM_PHASES.waiting);
    expect(beforeInput).toBeDefined();
    expect(afterInput).toBeDefined();
    expect(afterInput?.x).toBeGreaterThan(beforeInput?.x ?? 0);
    expect(afterInput?.lastProcessedInputSeq).toBe(1);
  });

  it("pauses warmup movement when the second player joins ready check", async () => {
    const harness = await createHarness();
    const firstClient = createClient("session-a");
    const secondClient = createClient("session-b");

    await join(harness.room, firstClient, "Alice");
    await harness.receive("input", firstClient, {
      type: "input",
      seq: 1,
      clientTime: Date.now(),
      left: false,
      right: true,
      up: false,
      down: false,
      jump: false,
      jumpPressed: false,
      interactPressed: false,
    });
    harness.step(100);

    await join(harness.room, secondClient, "Bob");

    const beforeReadyCheckStep = harness.getSnapshot().players.A?.x ?? 0;

    await harness.receive("input", firstClient, {
      type: "input",
      seq: 2,
      clientTime: Date.now(),
      left: false,
      right: true,
      up: false,
      down: false,
      jump: false,
      jumpPressed: false,
      interactPressed: false,
    });
    harness.step(100);

    const afterReadyCheckStep = harness.getSnapshot().players.A;

    expect(harness.getSnapshot().phase).toBe(ROOM_PHASES.readyCheck);
    expect(afterReadyCheckStep?.x).toBe(beforeReadyCheckStep);
    expect(afterReadyCheckStep?.lastProcessedInputSeq).toBe(1);
  });

  it("rejects a third player", async () => {
    const harness = await createHarness();
    const firstClient = createClient("session-a");
    const secondClient = createClient("session-b");
    const thirdClient = createClient("session-c");

    await join(harness.room, firstClient, "Alice");
    await join(harness.room, secondClient, "Bob");
    await join(harness.room, thirdClient, "Cara");

    expect(thirdClient.errors).toEqual([{ code: 4001, message: "Room is full" }]);
    expect(thirdClient.left).toBe(true);
    expect(Object.keys(harness.getSnapshot().players)).toEqual(["A", "B"]);
  });

  it("enters playing after both players are ready", async () => {
    const harness = await createHarness();
    const firstClient = createClient("session-a");
    const secondClient = createClient("session-b");

    await join(harness.room, firstClient, "Alice");
    await join(harness.room, secondClient, "Bob");
    await harness.receive("client_ready", firstClient, { type: "client_ready", ready: true });

    expect(harness.getSnapshot().phase).toBe(ROOM_PHASES.readyCheck);

    await harness.receive("client_ready", secondClient, { type: "client_ready", ready: true });

    const snapshot = harness.getSnapshot();

    expect(snapshot.phase).toBe(ROOM_PHASES.playing);
    expect(snapshot.players.A?.ready).toBe(true);
    expect(snapshot.players.B?.ready).toBe(true);
    expect(harness.broadcasts.some((message) => message.type === "level_start")).toBe(true);
  });

  it("lets player A select a level before ready check starts", async () => {
    const harness = await createHarness();
    const firstClient = createClient("session-a");

    await join(harness.room, firstClient, "Alice");

    const levelStartsBeforeSelect = harness.broadcasts.filter((message) => message.type === "level_start").length;

    await harness.receive("select_level", firstClient, { type: "select_level", levelIndex: 4 });

    const snapshot = harness.getSnapshot();
    const levelStartsAfterSelect = harness.broadcasts.filter((message) => message.type === "level_start").length;

    expect(snapshot.phase).toBe(ROOM_PHASES.waiting);
    expect(snapshot.levelIndex).toBe(4);
    expect(snapshot.levelId).toBe("level-005");
    expect(snapshot.players.A?.ready).toBe(false);
    expect(snapshot.restartVotes).toEqual({});
    expect(levelStartsAfterSelect).toBe(levelStartsBeforeSelect + 1);
  });

  it("ignores level selection from player B", async () => {
    const harness = await createHarness();
    const firstClient = createClient("session-a");
    const secondClient = createClient("session-b");

    await join(harness.room, firstClient, "Alice");
    await join(harness.room, secondClient, "Bob");

    await harness.receive("select_level", secondClient, { type: "select_level", levelIndex: 4 });

    const snapshot = harness.getSnapshot();

    expect(snapshot.phase).toBe(ROOM_PHASES.readyCheck);
    expect(snapshot.levelIndex).toBe(0);
    expect(snapshot.levelId).toBe("level-001");
  });

  it("keeps a dropped player seat during the reconnect window", async () => {
    const harness = await createHarness();
    const firstClient = createClient("session-a");
    const secondClient = createClient("session-b");

    await join(harness.room, firstClient, "Alice");
    await join(harness.room, secondClient, "Bob");
    await harness.receive("client_ready", firstClient, { type: "client_ready", ready: true });
    await harness.receive("client_ready", secondClient, { type: "client_ready", ready: true });

    const sentBeforeReconnect = firstClient.sent.length;
    const dropPromise = harness.room.onDrop(firstClient);
    await flushPromises();

    const droppedSnapshot = harness.getSnapshot();

    expect(droppedSnapshot.phase).toBe(ROOM_PHASES.playing);
    expect(droppedSnapshot.players.A?.connected).toBe(false);
    expect(droppedSnapshot.players.B?.connected).toBe(true);
    expect(harness.isLocked()).toBe(true);

    harness.resolveReconnection(firstClient.sessionId, firstClient);
    await dropPromise;

    const reconnectedSnapshot = harness.getSnapshot();
    const reconnectMessages = firstClient.sent.slice(sentBeforeReconnect).map((message) => message.type);

    expect(reconnectedSnapshot.phase).toBe(ROOM_PHASES.playing);
    expect(reconnectedSnapshot.players.A?.connected).toBe(true);
    expect(reconnectMessages).toContain("room_joined");
    expect(reconnectMessages).toContain("level_start");
    expect(harness.isLocked()).toBe(true);
  });

  it("removes a dropped player when the reconnect window expires", async () => {
    const harness = await createHarness();
    const firstClient = createClient("session-a");
    const secondClient = createClient("session-b");

    await join(harness.room, firstClient, "Alice");
    await join(harness.room, secondClient, "Bob");
    await harness.receive("client_ready", firstClient, { type: "client_ready", ready: true });
    await harness.receive("client_ready", secondClient, { type: "client_ready", ready: true });

    const dropPromise = harness.room.onDrop(firstClient);
    await flushPromises();

    expect(harness.getSnapshot().players.A?.connected).toBe(false);

    harness.rejectReconnection(firstClient.sessionId);
    await dropPromise;

    const snapshot = harness.getSnapshot();

    expect(snapshot.phase).toBe(ROOM_PHASES.waiting);
    expect(snapshot.players.A).toBeUndefined();
    expect(snapshot.players.B?.ready).toBe(false);
    expect(harness.isLocked()).toBe(false);
  });

  it("restarts the current level after both players approve restart_vote", async () => {
    const harness = await createHarness();
    const firstClient = createClient("session-a");
    const secondClient = createClient("session-b");

    await join(harness.room, firstClient, "Alice");
    await join(harness.room, secondClient, "Bob");
    await harness.receive("client_ready", firstClient, { type: "client_ready", ready: true });
    await harness.receive("client_ready", secondClient, { type: "client_ready", ready: true });

    const beforeRestart = harness.getSnapshot();
    const levelStartsBeforeRestart = harness.broadcasts.filter((message) => message.type === "level_start").length;

    await harness.receive("restart_vote", firstClient, { type: "restart_vote", approve: true });

    expect(harness.getSnapshot().restartVotes).toEqual({ A: true });

    await harness.receive("restart_vote", secondClient, { type: "restart_vote", approve: true });

    const afterRestart = harness.getSnapshot();
    const levelStartsAfterRestart = harness.broadcasts.filter((message) => message.type === "level_start").length;

    expect(afterRestart.phase).toBe(ROOM_PHASES.playing);
    expect(afterRestart.levelIndex).toBe(beforeRestart.levelIndex);
    expect(afterRestart.levelId).toBe(beforeRestart.levelId);
    expect(afterRestart.restartVotes).toEqual({});
    expect(levelStartsAfterRestart).toBe(levelStartsBeforeRestart + 1);
  });

  it("moves a player after receiving input during playing", async () => {
    const harness = await createHarness();
    const firstClient = createClient("session-a");
    const secondClient = createClient("session-b");

    await join(harness.room, firstClient, "Alice");
    await join(harness.room, secondClient, "Bob");
    await harness.receive("client_ready", firstClient, { type: "client_ready", ready: true });
    await harness.receive("client_ready", secondClient, { type: "client_ready", ready: true });

    const beforeInput = harness.getSnapshot().players.A;

    await harness.receive("input", firstClient, {
      type: "input",
      seq: 1,
      clientTime: Date.now(),
      left: false,
      right: true,
      up: false,
      down: false,
      jump: false,
      jumpPressed: false,
      interactPressed: false,
    });
    harness.step(100);

    const afterInput = harness.getSnapshot().players.A;

    expect(beforeInput).toBeDefined();
    expect(afterInput).toBeDefined();
    expect(afterInput?.x).toBeGreaterThan(beforeInput?.x ?? 0);
    expect(afterInput?.lastProcessedInputSeq).toBe(1);
  });

  it("falls back to a fixed tick when the simulation delta is near zero", async () => {
    const harness = await createHarness();
    const firstClient = createClient("session-a");
    const secondClient = createClient("session-b");

    await join(harness.room, firstClient, "Alice");
    await join(harness.room, secondClient, "Bob");
    await harness.receive("client_ready", firstClient, { type: "client_ready", ready: true });
    await harness.receive("client_ready", secondClient, { type: "client_ready", ready: true });

    const beforeInput = harness.getSnapshot().players.A;

    await harness.receive("input", firstClient, {
      type: "input",
      seq: 1,
      clientTime: Date.now(),
      left: false,
      right: true,
      up: false,
      down: false,
      jump: false,
      jumpPressed: false,
      interactPressed: false,
    });
    harness.step(0.000016);

    const afterInput = harness.getSnapshot().players.A;

    expect(beforeInput).toBeDefined();
    expect(afterInput).toBeDefined();
    expect(afterInput?.x).toBeGreaterThan(beforeInput?.x ?? 0);
    expect(afterInput?.lastProcessedInputSeq).toBe(1);
  });

  it("keeps the newest input when the player input queue is full", async () => {
    const harness = await createHarness();
    const firstClient = createClient("session-a");
    const secondClient = createClient("session-b");

    await join(harness.room, firstClient, "Alice");
    await join(harness.room, secondClient, "Bob");
    await harness.receive("client_ready", firstClient, { type: "client_ready", ready: true });
    await harness.receive("client_ready", secondClient, { type: "client_ready", ready: true });

    const beforeInput = harness.getSnapshot().players.A;

    for (let seq = 1; seq <= 25; seq += 1) {
      await harness.receive("input", firstClient, {
        type: "input",
        seq,
        clientTime: Date.now(),
        left: false,
        right: false,
        up: false,
        down: false,
        jump: false,
        jumpPressed: false,
        interactPressed: false,
      });
    }

    await harness.receive("input", firstClient, {
      type: "input",
      seq: 26,
      clientTime: Date.now(),
      left: false,
      right: true,
      up: false,
      down: false,
      jump: false,
      jumpPressed: false,
      interactPressed: false,
    });
    harness.step(100);

    const afterInput = harness.getSnapshot().players.A;

    expect(beforeInput).toBeDefined();
    expect(afterInput).toBeDefined();
    expect(afterInput?.x).toBeGreaterThan(beforeInput?.x ?? 0);
    expect(afterInput?.lastProcessedInputSeq).toBe(26);
  });

  it("sustains a press-pulse so a sub-tick tap still produces a visible burst", async () => {
    const harness = await createHarness();
    const firstClient = createClient("session-a");
    const secondClient = createClient("session-b");

    await join(harness.room, firstClient, "Alice");
    await join(harness.room, secondClient, "Bob");
    await harness.receive("client_ready", firstClient, { type: "client_ready", ready: true });
    await harness.receive("client_ready", secondClient, { type: "client_ready", ready: true });

    const beforeInput = harness.getSnapshot().players.A;

    // Very fast tap: press-right and release-right both arrive before the next
    // server tick, so the queue holds a full press+release cycle.
    await harness.receive("input", firstClient, {
      type: "input",
      seq: 1,
      clientTime: Date.now(),
      left: false,
      right: true,
      up: false,
      down: false,
      jump: false,
      jumpPressed: false,
      interactPressed: false,
    });
    await harness.receive("input", firstClient, {
      type: "input",
      seq: 2,
      clientTime: Date.now(),
      left: false,
      right: false,
      up: false,
      down: false,
      jump: false,
      jumpPressed: false,
      interactPressed: false,
    });

    // Tick 1: press edge detected, direction pulse kicks in, player moves.
    harness.step(1000 / 60);
    const afterTick1 = harness.getSnapshot().players.A;

    expect(beforeInput).toBeDefined();
    expect(afterTick1).toBeDefined();
    expect(afterTick1?.x).toBeGreaterThan(beforeInput?.x ?? 0);
    expect(afterTick1?.facing).toBe(1);
    expect(afterTick1?.lastProcessedInputSeq).toBe(2);

    const tick1X = afterTick1?.x ?? 0;

    // Ticks 2 and 3: queue is empty but the pulse keeps the direction active
    // so the player keeps moving for a couple more frames.
    harness.step(1000 / 60);
    const afterTick2 = harness.getSnapshot().players.A;
    expect(afterTick2?.x).toBeGreaterThan(tick1X);

    const tick2X = afterTick2?.x ?? 0;
    harness.step(1000 / 60);
    const afterTick3 = harness.getSnapshot().players.A;
    expect(afterTick3?.x).toBeGreaterThan(tick2X);

    // Tick 4: the pulse is still visible for its final frame.
    const tick3X = afterTick3?.x ?? 0;
    harness.step(1000 / 60);
    const afterTick4 = harness.getSnapshot().players.A;
    expect(afterTick4?.x).toBeGreaterThan(tick3X);

    // Tick 5: the pulse has fully decayed and no new input has arrived, so
    // the player must come to rest.
    const tick4X = afterTick4?.x ?? 0;
    harness.step(1000 / 60);
    const afterTick5 = harness.getSnapshot().players.A;
    expect(afterTick5?.x).toBe(tick4X);
  });

  it("accepts a late directional press when release arrives first in the same tap", async () => {
    const harness = await createHarness();
    const firstClient = createClient("session-a");
    const secondClient = createClient("session-b");

    await join(harness.room, firstClient, "Alice");
    await join(harness.room, secondClient, "Bob");
    await harness.receive("client_ready", firstClient, { type: "client_ready", ready: true });
    await harness.receive("client_ready", secondClient, { type: "client_ready", ready: true });

    const beforeInput = harness.getSnapshot().players.A;

    await harness.receive("input", firstClient, {
      type: "input",
      seq: 2,
      clientTime: Date.now(),
      left: false,
      right: false,
      up: false,
      down: false,
      jump: false,
      jumpPressed: false,
      interactPressed: false,
    });
    await harness.receive("input", firstClient, {
      type: "input",
      seq: 1,
      clientTime: Date.now(),
      left: false,
      right: true,
      up: false,
      down: false,
      jump: false,
      jumpPressed: false,
      interactPressed: false,
    });

    harness.step(1000 / 60);

    const afterInput = harness.getSnapshot().players.A;

    expect(beforeInput).toBeDefined();
    expect(afterInput).toBeDefined();
    expect(afterInput?.x).toBeGreaterThan(beforeInput?.x ?? 0);
    expect(afterInput?.lastProcessedInputSeq).toBe(2);
  });

  it("stops the player immediately when a held direction is released mid-tick", async () => {
    const harness = await createHarness();
    const firstClient = createClient("session-a");
    const secondClient = createClient("session-b");

    await join(harness.room, firstClient, "Alice");
    await join(harness.room, secondClient, "Bob");
    await harness.receive("client_ready", firstClient, { type: "client_ready", ready: true });
    await harness.receive("client_ready", secondClient, { type: "client_ready", ready: true });

    // Hold right for a few ticks so the pulse has already expired and the
    // player is purely driven by the held baseline.
    await harness.receive("input", firstClient, {
      type: "input",
      seq: 1,
      clientTime: Date.now(),
      left: false,
      right: true,
      up: false,
      down: false,
      jump: false,
      jumpPressed: false,
      interactPressed: false,
    });
    for (let i = 0; i < 5; i += 1) harness.step(1000 / 60);

    const afterHold = harness.getSnapshot().players.A;
    expect(afterHold?.x).toBeGreaterThan(0);

    // Now release the key and step one tick. The player must stop immediately.
    await harness.receive("input", firstClient, {
      type: "input",
      seq: 2,
      clientTime: Date.now(),
      left: false,
      right: false,
      up: false,
      down: false,
      jump: false,
      jumpPressed: false,
      interactPressed: false,
    });
    harness.step(1000 / 60);
    const afterReleaseTick = harness.getSnapshot().players.A;
    const afterReleaseX = afterReleaseTick?.x ?? 0;

    harness.step(1000 / 60);
    const afterIdle = harness.getSnapshot().players.A;
    expect(afterIdle?.x).toBe(afterReleaseX);
  });

  it("continues applying the last held direction between input packets", async () => {
    const harness = await createHarness();
    const firstClient = createClient("session-a");
    const secondClient = createClient("session-b");

    await join(harness.room, firstClient, "Alice");
    await join(harness.room, secondClient, "Bob");
    await harness.receive("client_ready", firstClient, { type: "client_ready", ready: true });
    await harness.receive("client_ready", secondClient, { type: "client_ready", ready: true });

    await harness.receive("input", firstClient, {
      type: "input",
      seq: 1,
      clientTime: Date.now(),
      left: false,
      right: true,
      up: false,
      down: false,
      jump: false,
      jumpPressed: false,
      interactPressed: false,
    });
    harness.step(100);

    const afterFirstStep = harness.getSnapshot().players.A;

    harness.step(100);

    const afterSecondStep = harness.getSnapshot().players.A;

    expect(afterFirstStep).toBeDefined();
    expect(afterSecondStep).toBeDefined();
    expect(afterSecondStep?.x).toBeGreaterThan(afterFirstStep?.x ?? 0);
    expect(afterSecondStep?.lastProcessedInputSeq).toBe(1);
  });
});

describe("CoopRoom toggle and delayed targets", () => {
  it("flips the toggle latch on each press-edge inside the button", () => {
    const room = new CoopRoom();
    const level = createToggleDoorLevel();
    const player = makeOverlapPlayer({ x: 1000, y: 608 });
    const internals = installLevelRuntime(room, level, [player]);
    const buttonRect = level.buttons[0].rect;
    const overlapX = buttonRect.x + 4;
    const farX = level.world.width - 80;

    // Initial state: door closed, latch off.
    internals.update(1000);
    expect(internals.snapshotDoor("door-toggle")?.open).toBe(false);

    // First press-edge: latch on, door opens.
    player.x = overlapX;
    internals.update(1100);
    expect(internals.snapshotButton("button-toggle")?.active).toBe(true);
    expect(internals.snapshotDoor("door-toggle")?.open).toBe(true);

    // Stay overlapping: latch is sticky, no flip.
    internals.update(1300);
    expect(internals.snapshotDoor("door-toggle")?.open).toBe(true);

    // Step off and wait past cooldown.
    player.x = farX;
    internals.update(1600);
    expect(internals.snapshotDoor("door-toggle")?.open).toBe(true);

    // Second press-edge: latch off, door closes.
    player.x = overlapX;
    internals.update(1700);
    expect(internals.snapshotDoor("door-toggle")?.open).toBe(false);
  });

  it("ignores rapid re-presses inside the cooldown window", () => {
    const room = new CoopRoom();
    const level = createToggleDoorLevel();
    const player = makeOverlapPlayer({ x: 1000, y: 608 });
    const internals = installLevelRuntime(room, level, [player]);
    const buttonRect = level.buttons[0].rect;
    const overlapX = buttonRect.x + 4;
    const farX = level.world.width - 80;

    player.x = overlapX;
    internals.update(2000); // first edge -> latched true
    expect(internals.snapshotDoor("door-toggle")?.open).toBe(true);

    player.x = farX;
    internals.update(2030); // step off well within cooldown
    player.x = overlapX;
    internals.update(2050); // second edge during cooldown should be ignored
    expect(internals.snapshotDoor("door-toggle")?.open).toBe(true);

    // After cooldown clears, the next press-edge flips it off.
    player.x = farX;
    internals.update(2400);
    player.x = overlapX;
    internals.update(2450);
    expect(internals.snapshotDoor("door-toggle")?.open).toBe(false);
  });

  it("delays target activation by delayMs and cancels stale flips", () => {
    const room = new CoopRoom();
    const level = createDelayedDoorLevel();
    const player = makeOverlapPlayer({ x: 1000, y: 608 });
    const internals = installLevelRuntime(room, level, [player]);
    const buttonRect = level.buttons[0].rect;
    const overlapX = buttonRect.x + 4;
    const farX = level.world.width - 80;

    // Player on plate at t=1000. Door must NOT open until 1000 + delay.
    player.x = overlapX;
    internals.update(1000);
    expect(internals.snapshotButton("button-delay")?.active).toBe(true);
    expect(internals.snapshotDoor("door-delay")?.open).toBe(false);

    // Halfway through the delay still closed.
    internals.update(1400);
    expect(internals.snapshotDoor("door-delay")?.open).toBe(false);

    // After delay elapsed, door opens.
    internals.update(1850);
    expect(internals.snapshotDoor("door-delay")?.open).toBe(true);

    // Step off: door should stay open until release-delay completes.
    player.x = farX;
    internals.update(1900);
    expect(internals.snapshotDoor("door-delay")?.open).toBe(true);

    internals.update(2750);
    expect(internals.snapshotDoor("door-delay")?.open).toBe(false);

    // Quick tap shorter than delay must NOT trigger the door at all.
    player.x = overlapX;
    internals.update(3000);
    player.x = farX;
    internals.update(3100);
    internals.update(4000);
    expect(internals.snapshotDoor("door-delay")?.open).toBe(false);
  });

  it("resets toggle latch and pending delays when the level changes", async () => {
    const harness = await createHarness();
    const room = harness.room as unknown as RuntimeAccess;

    const togglerLevel = createToggleDoorLevel();
    const delayedLevel = createDelayedDoorLevel();
    const player = makeOverlapPlayer({ x: togglerLevel.buttons[0].rect.x + 4, y: 608 });

    installLevelRuntime(harness.room, togglerLevel, [player]);
    room.updateLevelMechanics(5000);
    expect(room.doors["door-toggle"]?.open).toBe(true);

    // Switch level. The runtime maps must be cleared so the new toggle starts off.
    room.initializeLevel(0);
    installLevelRuntime(harness.room, delayedLevel, [player]);
    room.updateLevelMechanics(6000);
    expect(room.doors["door-delay"]?.open).toBe(false);
  });
});

type RuntimeAccess = {
  currentLevel: LevelSchema | null;
  doors: Record<string, DoorStateSnapshot>;
  buttons: Record<string, ButtonStateSnapshot>;
  playersBySessionId: Map<string, unknown>;
  phase: string;
  buttonRuntime: Map<string, unknown>;
  targetRuntime: Map<string, unknown>;
  movingRuntime: Map<string, unknown>;
  trapRuntime: Map<string, unknown>;
  updateLevelMechanics: (now: number) => void;
  initializeLevel: (levelIndex: number) => void;
};

type ToggleHarness = {
  update: (now: number) => void;
  snapshotButton: (id: string) => ButtonStateSnapshot | undefined;
  snapshotDoor: (id: string) => DoorStateSnapshot | undefined;
};

type RuntimePlayerOverlap = {
  sessionId: string;
  role: string;
  connected: boolean;
  alive: boolean;
  x: number;
  y: number;
  interactQueued: boolean;
  interactQueuedUntil: number;
};

function makeOverlapPlayer(overrides: Partial<RuntimePlayerOverlap> = {}): RuntimePlayerOverlap {
  return {
    sessionId: "session-toggle",
    role: "A",
    connected: true,
    alive: true,
    x: 100,
    y: 608,
    interactQueued: false,
    interactQueuedUntil: 0,
    ...overrides,
  };
}

function installLevelRuntime(
  room: CoopRoom,
  level: LevelSchema,
  players: RuntimePlayerOverlap[],
): ToggleHarness {
  const internals = room as unknown as RuntimeAccess;

  internals.currentLevel = level;
  internals.phase = ROOM_PHASES.playing;
  internals.buttonRuntime.clear();
  internals.targetRuntime.clear();
  internals.movingRuntime.clear();
  internals.trapRuntime.clear();
  internals.playersBySessionId.clear();

  for (const player of players) {
    internals.playersBySessionId.set(player.sessionId, player);
  }

  return {
    update: (now) => {
      internals.updateLevelMechanics(now);
    },
    snapshotButton: (id) => internals.buttons[id],
    snapshotDoor: (id) => internals.doors[id],
  };
}

function createToggleDoorLevel(): LevelSchema {
  return {
    schemaVersion: 1,
    id: "level-999",
    name: "Toggle Door",
    world: { width: 1280, height: 720, gravity: 1800, background: "test" },
    players: [
      { playerIndex: 0, x: 80, y: 608, facing: 1 },
      { playerIndex: 1, x: 140, y: 608, facing: 1 },
    ],
    platforms: [{ id: "floor", type: "solid", rect: { x: 0, y: 656, w: 1280, h: 64 } }],
    buttons: [
      {
        id: "button-toggle",
        kind: "pressure",
        mode: "toggle",
        rect: { x: 600, y: 632, w: 64, h: 24 },
        cooldownMs: 200,
        targets: [{ targetId: "door-toggle", action: "open" }],
      },
    ],
    doors: [
      {
        id: "door-toggle",
        rect: { x: 900, y: 360, w: 40, h: 296 },
        startsOpen: false,
      },
    ],
    traps: [],
    exits: [
      {
        id: "exit-a",
        rect: { x: 1160, y: 560, w: 72, h: 96 },
        requiresBothPlayers: true,
        holdMs: 500,
      },
    ],
  };
}

function createDelayedDoorLevel(): LevelSchema {
  return {
    schemaVersion: 1,
    id: "level-998",
    name: "Delayed Door",
    world: { width: 1280, height: 720, gravity: 1800, background: "test" },
    players: [
      { playerIndex: 0, x: 80, y: 608, facing: 1 },
      { playerIndex: 1, x: 140, y: 608, facing: 1 },
    ],
    platforms: [{ id: "floor", type: "solid", rect: { x: 0, y: 656, w: 1280, h: 64 } }],
    buttons: [
      {
        id: "button-delay",
        kind: "pressure",
        mode: "hold",
        rect: { x: 600, y: 632, w: 64, h: 24 },
        targets: [{ targetId: "door-delay", action: "open", delayMs: 800 }],
      },
    ],
    doors: [
      {
        id: "door-delay",
        rect: { x: 900, y: 360, w: 40, h: 296 },
        startsOpen: false,
      },
    ],
    traps: [],
    exits: [
      {
        id: "exit-a",
        rect: { x: 1160, y: 560, w: 72, h: 96 },
        requiresBothPlayers: true,
        holdMs: 500,
      },
    ],
  };
}

async function createHarness(): Promise<Harness> {
  const room = new CoopRoom();
  const handlers = new Map<string, MessageHandler>();
  const broadcasts: SentMessage[] = [];
  const metadata: Record<string, unknown> = {};
  const pendingReconnections = new Map<string, PendingReconnection>();
  let locked = false;
  let simulationCallback: ((deltaTime: number) => void) | undefined;

  const patchedRoom = room as unknown as {
    broadcast: (type: string | number, message: unknown) => void;
    onMessage: (type: string | number, callback: MessageHandler) => () => void;
    setMetadata: (nextMetadata: Record<string, unknown>) => Promise<void>;
    lock: () => Promise<void>;
    unlock: () => Promise<void>;
    allowReconnection: (client: CoopClient, seconds: number | "manual") => Promise<CoopClient>;
    setSimulationInterval: (callback?: (deltaTime: number) => void, delay?: number) => void;
  };

  patchedRoom.broadcast = (type, message) => {
    broadcasts.push({ type, message });
  };
  patchedRoom.onMessage = (type, callback) => {
    handlers.set(String(type), callback);
    return () => {
      handlers.delete(String(type));
    };
  };
  patchedRoom.setMetadata = async (nextMetadata) => {
    Object.assign(metadata, nextMetadata);
  };
  patchedRoom.lock = async () => {
    locked = true;
  };
  patchedRoom.unlock = async () => {
    locked = false;
  };
  patchedRoom.allowReconnection = (client) => {
    let resolveReconnection!: (reconnectedClient: CoopClient) => void;
    let rejectReconnection!: (error?: unknown) => void;
    const promise = new Promise<CoopClient>((resolve, reject) => {
      resolveReconnection = resolve;
      rejectReconnection = reject;
    });

    pendingReconnections.set(client.sessionId, {
      resolve: resolveReconnection,
      reject: rejectReconnection,
    });

    return promise;
  };
  patchedRoom.setSimulationInterval = (callback) => {
    simulationCallback = callback;
  };

  Object.defineProperty(room, "locked", {
    configurable: true,
    get: () => locked,
  });

  await room.onCreate();

  return {
    room,
    broadcasts,
    metadata,
    getSnapshot: () => (room as unknown as { createRoomState: () => RoomStateMessage }).createRoomState(),
    isLocked: () => locked,
    resolveReconnection: (sessionId, client) => {
      const pending = pendingReconnections.get(sessionId);

      expect(pending).toBeDefined();
      pending?.resolve(client);
      pendingReconnections.delete(sessionId);
    },
    rejectReconnection: (sessionId) => {
      const pending = pendingReconnections.get(sessionId);

      expect(pending).toBeDefined();
      pending?.reject(new Error("expired"));
      pendingReconnections.delete(sessionId);
    },
    receive: async (type, client, message) => {
      const handler = handlers.get(type);

      expect(handler).toBeDefined();

      await handler?.(client, message);
    },
    step: (deltaMs) => {
      simulationCallback?.(deltaMs);
    },
  };
}

async function join(room: CoopRoom, client: TestClient, playerName: string): Promise<void> {
  await room.onJoin(client, {
    playerName,
    clientVersion: PROTOCOL_VERSION,
  });
}

function createClient(sessionId: string): TestClient {
  const sent: SentMessage[] = [];
  const errors: { code: number; message: string }[] = [];
  let left = false;

  return {
    sessionId,
    sent,
    errors,
    get left() {
      return left;
    },
    send: (type: string | number, message: unknown) => {
      sent.push({ type, message });
    },
    error: (code: number, message: string) => {
      errors.push({ code, message });
    },
    leave: () => {
      left = true;
    },
  } as unknown as TestClient;
}

async function flushPromises(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}
