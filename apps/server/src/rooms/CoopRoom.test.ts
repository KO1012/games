import { PROTOCOL_VERSION, ROOM_PHASES, type RoomStateMessage } from "@coop-game/shared";
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
