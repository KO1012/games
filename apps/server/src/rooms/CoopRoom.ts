import {
  DEFAULT_CLIENT_HEIGHT,
  DEFAULT_CLIENT_WIDTH,
  INPUT_SEND_HZ,
  PLAYER_JUMP_SPEED,
  PLAYER_MAX_FALL_SPEED,
  PLAYER_RESPAWN_MS,
  PLAYER_ROLES,
  PLAYER_SIZE,
  PLAYER_SPEED,
  PROTOCOL_VERSION,
  ROOM_CODE_LENGTH,
  ROOM_PHASES,
  SERVER_TICK_HZ,
  STATE_PATCH_HZ,
  rectsOverlap,
  type ActorRect,
  type ButtonDefinition,
  type ButtonStateSnapshot,
  type ClientReadyMessage,
  type DoorStateSnapshot,
  type InputDebugMessage,
  type InputMessage,
  type LevelSchema,
  type MovingPlatformStateSnapshot,
  type PingMessage,
  type PlatformDefinition,
  type PlayerRole,
  type PlayerSnapshot,
  type Rect,
  type RestartVoteMessage,
  type RoomPhase,
  type RoomStateMessage,
  type ServerMessageMap,
  type TargetAction,
  type TrapDefinition,
  type TrapStateSnapshot,
} from "@coop-game/shared";
import { Room, type Client } from "colyseus";

import { loadLevelSet } from "../levels.js";

type CoopClient = Client<{
  messages: ServerMessageMap;
}>;

type JoinOptions = {
  playerName?: string;
  clientVersion?: string;
};

type DirectionPulseTicks = {
  left: number;
  right: number;
  up: number;
  down: number;
};

type AxisIntent = -1 | 0 | 1;

type PlayerRecord = PlayerSnapshot & {
  inputQueue: InputMessage[];
  lastInput: InputMessage | null;
  lastInputAt: number;
  interactQueued: boolean;
  interactQueuedUntil: number;
  jumpQueued: boolean;
  directionPulseTicks: DirectionPulseTicks;
  horizontalIntent: AxisIntent;
  verticalIntent: AxisIntent;
};

type ButtonRuntime = {
  activeUntil: number;
  cooldownUntil: number;
};

type PathRuntime = {
  x: number;
  y: number;
  targetIndex: number;
  direction: 1 | -1;
};

type MechanismOverrides = {
  doors: Map<string, boolean>;
  traps: Map<string, boolean>;
  movingPlatforms: Map<string, boolean>;
};

type CollisionRect = {
  rect: Rect;
  oneWay: boolean;
};

const roomCodeAlphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const broadcastIntervalMs = 1000 / STATE_PATCH_HZ;
const simulationIntervalMs = 1000 / SERVER_TICK_HZ;
const maxMessagesPerSecond = INPUT_SEND_HZ * 4;
const levelAdvanceDelayMs = 750;
const defaultExitHoldMs = 500;
/**
 * How many consecutive ticks a direction stays "pressed" after the server
 * detects a press-edge. Ensures that even a sub-tick physical tap produces a
 * clearly visible amount of movement on screen.
 */
const directionPulseTicks = 4;
const defaultTimedButtonMs = 5000;
const defaultInteractPulseMs = 350;
const interactInputBufferMs = 120;
const maxQueuedInputsPerPlayer = 20;
const maxInputReorderSeqGap = 12;
const maxInputReorderMs = 120;
const reconnectWindowSeconds = 30;
const debugInputEnabled = process.env.INPUT_DEBUG === "1";

function createServerInputDebugMessage(event: Record<string, unknown>): InputDebugMessage | null {
  if (!debugInputEnabled) return null;

  const message: InputDebugMessage = {
    type: "input_debug",
    source: "server",
    at: Date.now(),
    event,
  };

  // Keep this compact and grep-friendly.
  console.log("[server-input]", JSON.stringify({ at: message.at, ...event }));

  return message;
}

export class CoopRoom extends Room<{ client: CoopClient }> {
  public maxClients = 2;
  public maxMessagesPerSecond = maxMessagesPerSecond;

  private phase: RoomPhase = ROOM_PHASES.waiting;
  private readonly playersBySessionId = new Map<string, PlayerRecord>();
  private readonly sessionIdByRole = new Map<PlayerRole, string>();
  private readonly buttonRuntime = new Map<string, ButtonRuntime>();
  private readonly movingRuntime = new Map<string, PathRuntime>();
  private readonly trapRuntime = new Map<string, PathRuntime>();
  private levels: LevelSchema[] = [];
  private currentLevelIndex = 0;
  private currentLevel: LevelSchema | null = null;
  private buttons: Record<string, ButtonStateSnapshot> = {};
  private doors: Record<string, DoorStateSnapshot> = {};
  private traps: Record<string, TrapStateSnapshot> = {};
  private movingPlatforms: Record<string, MovingPlatformStateSnapshot> = {};
  private restartVotes: Partial<Record<PlayerRole, boolean>> = {};
  private broadcastAccumulatorMs = 0;
  private exitHoldStartedAt: number | null = null;
  private activeExitId: string | null = null;
  private pendingLevelAdvance = false;

  public async onCreate(): Promise<void> {
    this.roomId = createRoomCode();
    this.patchRate = null;
    this.levels = await loadLevelSet();
    this.initializeLevel(0);

    await this.updateMetadata();

    this.onMessage<ClientReadyMessage>("client_ready", (client, message) => {
      void this.handleClientReady(client, message);
    });

    this.onMessage<InputMessage>("input", (client, message) => {
      this.handleInput(client, message);
    });

    this.onMessage<RestartVoteMessage>("restart_vote", (client, message) => {
      void this.handleRestartVote(client, message);
    });

    this.onMessage<PingMessage>("ping", (client, message) => {
      if (isValidPingMessage(message)) {
        client.send("pong", {
          type: "pong",
          clientTime: message.clientTime,
          serverTime: Date.now(),
        });
      }
    });

    this.setSimulationInterval((deltaTime) => {
      this.tick(normalizeDeltaMs(deltaTime));
    }, simulationIntervalMs);
  }

  public async onJoin(client: CoopClient, options: JoinOptions): Promise<void> {
    if (options.clientVersion !== undefined && options.clientVersion !== PROTOCOL_VERSION) {
      client.error(4002, "Client version is not compatible");
      client.leave();
      return;
    }

    const role = this.assignRole();

    if (!role) {
      client.error(4001, "Room is full");
      client.leave();
      return;
    }

    const playerIndex = role === PLAYER_ROLES.A ? 0 : 1;
    const spawn = this.getSpawn(playerIndex);
    const playerName = sanitizePlayerName(options.playerName);

    this.sessionIdByRole.set(role, client.sessionId);
    this.playersBySessionId.set(client.sessionId, {
      sessionId: client.sessionId,
      playerIndex,
      role,
      name: playerName,
      connected: true,
      ready: false,
      x: spawn.x,
      y: spawn.y,
      vx: 0,
      vy: 0,
      facing: spawn.facing ?? 1,
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
    });

    client.send("room_joined", {
      roomCode: this.roomId,
      role,
      playerIndex,
    });

    if (this.playersBySessionId.size >= this.maxClients) {
      this.phase = ROOM_PHASES.readyCheck;
      await this.lock();
    } else {
      this.phase = ROOM_PHASES.waiting;
    }

    this.restartVotes = {};
    this.updateLevelMechanics(Date.now());
    await this.updateMetadata();

    if (this.currentLevel) {
      client.send("level_start", {
        type: "level_start",
        levelId: this.currentLevel.id,
        levelIndex: this.currentLevelIndex,
        level: this.currentLevel,
        serverTime: Date.now(),
      });
    }

    this.broadcastRoomState();
  }

  public async onDrop(client: CoopClient): Promise<void> {
    const player = this.playersBySessionId.get(client.sessionId);

    if (!player) {
      return;
    }

    await this.handleDroppedPlayer(client, player);
  }

  public async onLeave(client: CoopClient): Promise<void> {
    if (!this.playersBySessionId.has(client.sessionId)) {
      return;
    }

    await this.removePlayer(client.sessionId);
  }

  private async handleDroppedPlayer(client: CoopClient, player: PlayerRecord): Promise<void> {
    player.connected = false;
    player.vx = 0;
    player.vy = 0;
    delete this.restartVotes[player.role];

    if (this.phase !== ROOM_PHASES.playing && this.phase !== ROOM_PHASES.levelComplete && this.phase !== ROOM_PHASES.finished) {
      player.ready = false;
      this.phase = ROOM_PHASES.waiting;
    }

    this.resetPlayerInputState(player);
    this.exitHoldStartedAt = null;
    this.activeExitId = null;
    this.updateLevelMechanics(Date.now());
    await this.updateMetadata();
    this.broadcastRoomState();

    try {
      const reconnectedClient = (await this.allowReconnection(client, reconnectWindowSeconds)) as CoopClient;
      const currentPlayer = this.playersBySessionId.get(client.sessionId);

      if (!currentPlayer) {
        return;
      }

      currentPlayer.connected = true;

      if (this.playersBySessionId.size === this.maxClients && this.phase === ROOM_PHASES.waiting) {
        this.phase = ROOM_PHASES.readyCheck;
      }

      reconnectedClient.send("room_joined", {
        roomCode: this.roomId,
        role: currentPlayer.role,
        playerIndex: currentPlayer.playerIndex,
      });

      if (this.currentLevel) {
        reconnectedClient.send("level_start", {
          type: "level_start",
          levelId: this.currentLevel.id,
          levelIndex: this.currentLevelIndex,
          level: this.currentLevel,
          serverTime: Date.now(),
        });
      }

      this.updateLevelMechanics(Date.now());
      await this.updateMetadata();
      this.broadcastRoomState();
    } catch {
      await this.removePlayer(client.sessionId);
    }
  }

  private async removePlayer(sessionId: string): Promise<void> {
    const player = this.playersBySessionId.get(sessionId);

    if (player) {
      this.sessionIdByRole.delete(player.role);
      this.playersBySessionId.delete(sessionId);
      delete this.restartVotes[player.role];
    }

    for (const remainingPlayer of this.playersBySessionId.values()) {
      remainingPlayer.ready = false;
      this.resetPlayerInputState(remainingPlayer);
    }

    this.phase = ROOM_PHASES.waiting;
    this.exitHoldStartedAt = null;
    this.activeExitId = null;
    this.pendingLevelAdvance = false;

    if (this.locked) {
      await this.unlock();
    }

    this.updateLevelMechanics(Date.now());
    await this.updateMetadata();
    this.broadcastRoomState();
  }

  private tick(deltaMs: number): void {
    const now = Date.now();
    const deltaSeconds = Math.min(deltaMs, 100) / 1000;

    this.applyQueuedPlayerInputs(deltaSeconds, now);
    this.updateLevelMechanics(now);
    this.stepPathActors(deltaSeconds);
    this.updateLevelMechanics(now);
    this.applyTrapDamage(now);
    this.checkLevelComplete(now);
    this.broadcastAccumulatorMs += deltaMs;

    if (this.broadcastAccumulatorMs >= broadcastIntervalMs) {
      this.broadcastAccumulatorMs = 0;
      this.broadcastRoomState();
    }
  }

  private assignRole(): PlayerRole | null {
    if (!this.sessionIdByRole.has(PLAYER_ROLES.A)) {
      return PLAYER_ROLES.A;
    }

    if (!this.sessionIdByRole.has(PLAYER_ROLES.B)) {
      return PLAYER_ROLES.B;
    }

    return null;
  }

  private async handleClientReady(client: CoopClient, message: ClientReadyMessage): Promise<void> {
    const player = this.playersBySessionId.get(client.sessionId);

    if (!player || !player.connected || !isValidReadyMessage(message)) {
      return;
    }

    player.ready = message.ready;

    if (this.playersBySessionId.size < this.maxClients) {
      this.phase = ROOM_PHASES.waiting;
    } else if (this.allPlayersReady()) {
      await this.startPlaying();
    } else {
      this.phase = ROOM_PHASES.readyCheck;
    }

    await this.updateMetadata();
    this.broadcastRoomState();
  }

  private handleInput(client: CoopClient, message: InputMessage): void {
    const player = this.playersBySessionId.get(client.sessionId);

    if (!player || !player.connected) {
      this.debugInput({
        kind: "reject",
        reason: player ? "disconnected-player" : "no-player",
        sessionId: client.sessionId,
        message,
      });
      return;
    }

    if (!this.canProcessPlayerInput()) {
      this.debugInput({
        kind: "reject",
        reason: "cannot-process-input",
        phase: this.phase,
        sessionId: client.sessionId,
        role: player.role,
        seq: message?.seq,
        message,
      });
      return;
    }

    if (!isValidInputMessage(message)) {
      this.debugInput({
        kind: "reject",
        reason: "invalid-input",
        sessionId: client.sessionId,
        role: player.role,
        message,
      });
      return;
    }

    const now = Date.now();
    const isLateInput = message.seq <= player.lastProcessedInputSeq;

    if (isLateInput && !shouldAcceptLateInput(player, message, now)) {
      this.debugInput({
        kind: "reject",
        reason: "late-input",
        role: player.role,
        seq: message.seq,
        lastProcessedInputSeq: player.lastProcessedInputSeq,
        input: compactInput(message),
      });
      return;
    }

    if (player.inputQueue.length < maxQueuedInputsPerPlayer) {
      player.inputQueue.push(message);
    } else {
      player.inputQueue[player.inputQueue.length - 1] = message;
    }
    if (message.interactPressed) {
      player.interactQueued = true;
      player.interactQueuedUntil = now + interactInputBufferMs;
    }

    player.jumpQueued = player.jumpQueued || message.jumpPressed;
    player.lastProcessedInputSeq = Math.max(player.lastProcessedInputSeq, message.seq);
    player.lastInputAt = now;

    this.debugInput({
      kind: "enqueue",
      role: player.role,
      seq: message.seq,
      queueLength: player.inputQueue.length,
      lastProcessedInputSeq: player.lastProcessedInputSeq,
      input: compactInput(message),
    });
  }

  private async handleRestartVote(client: CoopClient, message: RestartVoteMessage): Promise<void> {
    const player = this.playersBySessionId.get(client.sessionId);

    if (!player || !player.connected || !isValidRestartVoteMessage(message)) {
      return;
    }

    if (message.approve) {
      this.restartVotes[player.role] = true;
    } else {
      delete this.restartVotes[player.role];
    }

    if (this.playersBySessionId.size === this.maxClients && Object.values(PLAYER_ROLES).every((role) => this.restartVotes[role])) {
      await this.restartCurrentLevel();
      return;
    }

    this.broadcastRoomState();
  }

  private allPlayersReady(): boolean {
    return (
      this.playersBySessionId.size === this.maxClients &&
      Array.from(this.playersBySessionId.values()).every((player) => player.connected && player.ready)
    );
  }

  private async startPlaying(): Promise<void> {
    this.phase = ROOM_PHASES.loadingLevel;
    this.broadcastRoomState();
    this.phase = ROOM_PHASES.playing;
    this.restartVotes = {};
    this.respawnPlayers();
    this.updateLevelMechanics(Date.now());
    this.broadcastLevelStart();
    await this.updateMetadata();
  }

  private applyQueuedPlayerInputs(deltaSeconds: number, now: number): void {
    for (const player of this.playersBySessionId.values()) {
      if (!player.connected) {
        player.vx = 0;
        player.vy = 0;
        continue;
      }

      if (!player.alive) {
        this.updateRespawn(player, now);
        continue;
      }

      if (!this.canProcessPlayerInput()) {
        player.vx = 0;
        player.vy = player.grounded ? 0 : player.vy;
        continue;
      }

      const effectiveInput = this.consumePlayerInputsForTick(player);
      this.applyPlatformerInput(player, effectiveInput, deltaSeconds);
    }
  }

  private canProcessPlayerInput(): boolean {
    return this.phase === ROOM_PHASES.playing || this.isWarmupActive();
  }

  private debugInput(event: Record<string, unknown>): void {
    const message = createServerInputDebugMessage(event);

    if (!message) return;

    this.broadcast("input_debug", message);
  }

  private isWarmupActive(): boolean {
    return this.phase === ROOM_PHASES.waiting && this.playersBySessionId.size === 1;
  }

  private consumePlayerInputsForTick(player: PlayerRecord): InputMessage {
    const baseline = player.lastInput ?? createNeutralInput();
    const queueConsumed = player.inputQueue.length > 0;

    let heldLeft = baseline.left;
    let heldRight = baseline.right;
    let heldUp = baseline.up;
    let heldDown = baseline.down;
    let heldJump = baseline.jump;

    let jumpPressed = false;
    let interactPressed = false;

    let seq = baseline.seq;
    let clientTime = baseline.clientTime;

    if (player.inputQueue.length > 0) {
      let prevLeft = baseline.left;
      let prevRight = baseline.right;
      let prevUp = baseline.up;
      let prevDown = baseline.down;

      const queuedInputs = [...player.inputQueue].sort((a, b) => a.seq - b.seq);

      for (const input of queuedInputs) {
        const isLatestSnapshot = input.seq >= seq;
        const axisX = Number(input.right) - Number(input.left);
        const axisY = Number(input.down) - Number(input.up);

        if (isLatestSnapshot && axisX > 0) {
          player.horizontalIntent = 1;
          player.directionPulseTicks.left = 0;
        } else if (isLatestSnapshot && axisX < 0) {
          player.horizontalIntent = -1;
          player.directionPulseTicks.right = 0;
        }

        if (isLatestSnapshot && axisY > 0) {
          player.verticalIntent = 1;
          player.directionPulseTicks.up = 0;
        } else if (isLatestSnapshot && axisY < 0) {
          player.verticalIntent = -1;
          player.directionPulseTicks.down = 0;
        }

        if (input.left && !prevLeft) {
          player.directionPulseTicks.left = Math.max(player.directionPulseTicks.left, directionPulseTicks);
          if (isLatestSnapshot) {
            player.directionPulseTicks.right = 0;
            player.horizontalIntent = -1;
          }
        }

        if (input.right && !prevRight) {
          player.directionPulseTicks.right = Math.max(player.directionPulseTicks.right, directionPulseTicks);
          if (isLatestSnapshot) {
            player.directionPulseTicks.left = 0;
            player.horizontalIntent = 1;
          }
        }

        if (input.up && !prevUp) {
          player.directionPulseTicks.up = Math.max(player.directionPulseTicks.up, directionPulseTicks);
          if (isLatestSnapshot) {
            player.directionPulseTicks.down = 0;
            player.verticalIntent = -1;
          }
        }

        if (input.down && !prevDown) {
          player.directionPulseTicks.down = Math.max(player.directionPulseTicks.down, directionPulseTicks);
          if (isLatestSnapshot) {
            player.directionPulseTicks.up = 0;
            player.verticalIntent = 1;
          }
        }

        // Direction held state must follow the latest snapshot.
        // Do NOT OR-merge left/right/up/down here.
        // Late old snapshots can refresh pulse visibility, but must not replace
        // the current held state or latest direction intent.
        // Short taps are represented by directionPulseTicks.
        if (isLatestSnapshot) {
          heldLeft = input.left;
          heldRight = input.right;
          heldUp = input.up;
          heldDown = input.down;
          heldJump = input.jump;
          seq = input.seq;
          clientTime = input.clientTime;
          player.lastInput = input;
        }

        jumpPressed = jumpPressed || input.jumpPressed;
        interactPressed = interactPressed || input.interactPressed;

        prevLeft = input.left;
        prevRight = input.right;
        prevUp = input.up;
        prevDown = input.down;
      }

      player.inputQueue = [];
    }

    let effectiveLeft = heldLeft || player.directionPulseTicks.left > 0;
    let effectiveRight = heldRight || player.directionPulseTicks.right > 0;
    let effectiveUp = heldUp || player.directionPulseTicks.up > 0;
    let effectiveDown = heldDown || player.directionPulseTicks.down > 0;

    if (effectiveLeft && effectiveRight) {
      if (player.horizontalIntent > 0) {
        effectiveLeft = false;
      } else if (player.horizontalIntent < 0) {
        effectiveRight = false;
      } else {
        effectiveLeft = false;
        effectiveRight = false;
      }
    }

    if (effectiveUp && effectiveDown) {
      if (player.verticalIntent > 0) {
        effectiveUp = false;
      } else if (player.verticalIntent < 0) {
        effectiveDown = false;
      } else {
        effectiveUp = false;
        effectiveDown = false;
      }
    }

    if (player.directionPulseTicks.left > 0) player.directionPulseTicks.left -= 1;
    if (player.directionPulseTicks.right > 0) player.directionPulseTicks.right -= 1;
    if (player.directionPulseTicks.up > 0) player.directionPulseTicks.up -= 1;
    if (player.directionPulseTicks.down > 0) player.directionPulseTicks.down -= 1;

    const effectiveInput: InputMessage = {
      type: "input",
      seq,
      clientTime,
      left: effectiveLeft,
      right: effectiveRight,
      up: effectiveUp,
      down: effectiveDown,
      jump: heldJump,
      jumpPressed,
      interactPressed,
    };

    this.debugInput({
      kind: "consume",
      role: player.role,
      queueConsumed,
      seq: effectiveInput.seq,
      input: compactInput(effectiveInput),
      horizontalIntent: player.horizontalIntent,
      verticalIntent: player.verticalIntent,
      pulses: { ...player.directionPulseTicks },
    });

    return effectiveInput;
  }

  private updateRespawn(player: PlayerRecord, now: number): void {
    player.vx = 0;
    player.vy = 0;

    if (player.respawnAt > 0 && now >= player.respawnAt) {
      const spawn = this.getSpawn(player.playerIndex);

      player.x = spawn.x;
      player.y = spawn.y;
      player.facing = spawn.facing ?? 1;
      player.alive = true;
      player.grounded = true;
      player.respawnAt = 0;
      this.resetPlayerInputState(player);
    }
  }

  private resetPlayerInputState(player: PlayerRecord): void {
    player.inputQueue = [];
    player.lastInput = null;
    player.interactQueued = false;
    player.interactQueuedUntil = 0;
    player.jumpQueued = false;
    player.horizontalIntent = 0;
    player.verticalIntent = 0;
    this.resetDirectionPulses(player);
  }

  private resetDirectionPulses(player: PlayerRecord): void {
    player.directionPulseTicks.left = 0;
    player.directionPulseTicks.right = 0;
    player.directionPulseTicks.up = 0;
    player.directionPulseTicks.down = 0;
  }

  private applyPlatformerInput(player: PlayerRecord, input: InputMessage, deltaSeconds: number): void {
    const axisX = Number(input.right) - Number(input.left);
    const worldWidth = this.currentLevel?.world.width ?? DEFAULT_CLIENT_WIDTH;
    const worldHeight = this.currentLevel?.world.height ?? DEFAULT_CLIENT_HEIGHT;
    const previousX = player.x;
    const previousY = player.y;

    player.vx = axisX * PLAYER_SPEED;

    if (player.jumpQueued && player.grounded) {
      player.vy = -PLAYER_JUMP_SPEED;
      player.grounded = false;
    }

    player.jumpQueued = false;
    player.vy = clamp(player.vy + (this.currentLevel?.world.gravity ?? 1800) * deltaSeconds, -PLAYER_JUMP_SPEED, PLAYER_MAX_FALL_SPEED);

    if (axisX !== 0) {
      player.facing = axisX > 0 ? 1 : -1;
    }

    const attemptedX = clamp(player.x + player.vx * deltaSeconds, 0, worldWidth - PLAYER_SIZE);
    player.x = attemptedX;

    const horizontalCollision = this.findHorizontalCollision(player);

    if (horizontalCollision) {
      player.x = previousX;
      player.vx = 0;
    }

    this.debugInput({
      kind: "physics-x",
      role: player.role,
      seq: input.seq,
      axisX,
      input: compactInput(input),
      deltaSeconds,
      previousX,
      attemptedX,
      finalX: player.x,
      vx: player.vx,
      blocked: Boolean(horizontalCollision),
      collisionId: horizontalCollision?.id ?? null,
      collisionOneWay: horizontalCollision?.oneWay ?? null,
    });

    player.y = clamp(player.y + player.vy * deltaSeconds, 0, worldHeight - PLAYER_SIZE);
    player.grounded = false;

    this.resolveVerticalCollisions(player, previousY, input.down);

    if (player.y >= worldHeight - PLAYER_SIZE) {
      player.y = worldHeight - PLAYER_SIZE;
      player.vy = 0;
      player.grounded = true;
    }
  }

  private updateLevelMechanics(now: number): void {
    if (!this.currentLevel) {
      this.buttons = {};
      this.doors = {};
      this.traps = {};
      this.movingPlatforms = {};
      return;
    }

    const overrides: MechanismOverrides = {
      doors: new Map(),
      traps: new Map(),
      movingPlatforms: new Map(),
    };
    const buttons: Record<string, ButtonStateSnapshot> = {};

    for (const button of this.currentLevel.buttons) {
      const buttonState = this.updateButton(button, now);

      buttons[button.id] = buttonState;

      if (buttonState.active) {
        for (const target of button.targets) {
          applyTargetOverride(target, this.currentLevel, overrides);
        }
      }
    }

    this.buttons = buttons;
    this.doors = Object.fromEntries(
      this.currentLevel.doors.map((door) => {
        const open = overrides.doors.get(door.id) ?? door.startsOpen;
        return [
          door.id,
          {
            id: door.id,
            open,
            locked: false,
            progress: open ? 1 : 0,
          },
        ];
      }),
    );
    this.traps = Object.fromEntries(
      this.currentLevel.traps.map((trap) => {
        const runtime = this.trapRuntime.get(trap.id);
        const enabled = overrides.traps.get(trap.id) ?? trap.enabledByDefault;
        const active = enabled && this.isTrapCycleActive(trap, now);

        return [
          trap.id,
          {
            id: trap.id,
            enabled,
            active,
            x: runtime?.x ?? trap.rect.x,
            y: runtime?.y ?? trap.rect.y,
          },
        ];
      }),
    );
    this.movingPlatforms = Object.fromEntries(
      this.currentLevel.platforms
        .filter((platform) => platform.type === "moving")
        .map((platform) => {
          const runtime = this.movingRuntime.get(platform.id);
          const active = overrides.movingPlatforms.get(platform.id) ?? (platform.activeByDefault ?? true);

          return [
            platform.id,
            {
              id: platform.id,
              active,
              x: runtime?.x ?? platform.rect.x,
              y: runtime?.y ?? platform.rect.y,
            },
          ];
        }),
    );
  }

  private updateButton(button: ButtonDefinition, now: number): ButtonStateSnapshot {
    const runtime = this.getButtonRuntime(button.id);
    const pressedBy = this.getAlivePlayerActors()
      .filter((actor) => rectsOverlap(actor.rect, button.rect))
      .map((actor) => actor.id);
    const pressed = pressedBy.length > 0;
    const interactPressed = this.consumeInteractForButton(button, pressedBy, now);
    let active = false;

    if (button.kind === "pressure") {
      active = pressed;
    } else if (button.kind === "timed") {
      if (pressed && now >= runtime.cooldownUntil) {
        runtime.activeUntil = now + (button.holdMs ?? defaultTimedButtonMs);
        runtime.cooldownUntil = runtime.activeUntil + (button.cooldownMs ?? 0);
      }

      active = now < runtime.activeUntil;
    } else if (button.kind === "interact") {
      if (interactPressed && now >= runtime.cooldownUntil) {
        runtime.activeUntil = now + (button.holdMs ?? getLongestTargetDuration(button.targets, defaultInteractPulseMs));
        runtime.cooldownUntil = runtime.activeUntil + (button.cooldownMs ?? 0);
      }

      active = now < runtime.activeUntil;
    }

    return {
      id: button.id,
      active,
      pressedBy,
      cooldownUntil: runtime.cooldownUntil,
    };
  }

  private getButtonRuntime(buttonId: string): ButtonRuntime {
    const existing = this.buttonRuntime.get(buttonId);

    if (existing) {
      return existing;
    }

    const created = {
      activeUntil: 0,
      cooldownUntil: 0,
    };

    this.buttonRuntime.set(buttonId, created);
    return created;
  }

  private consumeInteractForButton(button: ButtonDefinition, pressedBy: string[], now: number): boolean {
    let consumed = false;

    for (const player of this.playersBySessionId.values()) {
      if (player.interactQueued && now > player.interactQueuedUntil) {
        player.interactQueued = false;
        player.interactQueuedUntil = 0;
      }

      if (player.interactQueued && pressedBy.includes(player.role) && rectsOverlap(this.getPlayerRect(player), button.rect)) {
        player.interactQueued = false;
        player.interactQueuedUntil = 0;
        consumed = true;
      }
    }

    return consumed;
  }

  private stepPathActors(deltaSeconds: number): void {
    if (!this.currentLevel) {
      return;
    }

    for (const platform of this.currentLevel.platforms) {
      if (platform.type !== "moving") {
        continue;
      }

      const state = this.movingPlatforms[platform.id];

      if (state?.active) {
        const previousRect = this.getPlatformRect(platform);
        const delta = stepPathRuntime(this.getMovingRuntime(platform), platform.path, platform.speed, deltaSeconds);

        if (delta.x !== 0 || delta.y !== 0) {
          this.carryPlayersOnPlatform(previousRect, delta);
        }
      }
    }

    for (const trap of this.currentLevel.traps) {
      if (trap.type !== "crusher") {
        continue;
      }

      const state = this.traps[trap.id];

      if (state?.enabled) {
        stepPathRuntime(this.getTrapRuntime(trap), trap.path, trap.speed, deltaSeconds);
      }
    }
  }

  private carryPlayersOnPlatform(platformRect: Rect, delta: { x: number; y: number }): void {
    const worldWidth = this.currentLevel?.world.width ?? DEFAULT_CLIENT_WIDTH;
    const worldHeight = this.currentLevel?.world.height ?? DEFAULT_CLIENT_HEIGHT;

    for (const player of this.playersBySessionId.values()) {
      if (!player.alive || !isStandingOnRect(this.getPlayerRect(player), platformRect)) {
        continue;
      }

      player.x = clamp(player.x + delta.x, 0, worldWidth - PLAYER_SIZE);
      player.y = clamp(player.y + delta.y, 0, worldHeight - PLAYER_SIZE);
    }
  }

  private getMovingRuntime(platform: PlatformDefinition): PathRuntime {
    const existing = this.movingRuntime.get(platform.id);

    if (existing) {
      return existing;
    }

    const created = createPathRuntime(platform.rect);
    this.movingRuntime.set(platform.id, created);
    return created;
  }

  private getTrapRuntime(trap: TrapDefinition): PathRuntime {
    const existing = this.trapRuntime.get(trap.id);

    if (existing) {
      return existing;
    }

    const created = createPathRuntime(trap.rect);
    this.trapRuntime.set(trap.id, created);
    return created;
  }

  private isTrapCycleActive(trap: TrapDefinition, now: number): boolean {
    if (!trap.cycle) {
      return true;
    }

    const totalMs = trap.cycle.activeMs + trap.cycle.inactiveMs;

    if (totalMs <= 0) {
      return true;
    }

    const elapsed = (now + trap.cycle.offsetMs) % totalMs;
    return elapsed < trap.cycle.activeMs;
  }

  private applyTrapDamage(now: number): void {
    if (!this.currentLevel || this.phase !== ROOM_PHASES.playing) {
      return;
    }

    const activeTrapRects = this.currentLevel.traps
      .filter((trap) => this.traps[trap.id]?.active)
      .map((trap) => this.getTrapRect(trap));

    if (activeTrapRects.length === 0) {
      return;
    }

    for (const player of this.playersBySessionId.values()) {
      if (!player.alive) {
        continue;
      }

      const playerRect = this.getPlayerRect(player);

      if (activeTrapRects.some((trapRect) => rectsOverlap(playerRect, trapRect))) {
        this.killPlayer(player, now);
      }
    }
  }

  private killPlayer(player: PlayerRecord, now: number): void {
    player.alive = false;
    player.vx = 0;
    player.vy = 0;
    player.respawnAt = now + PLAYER_RESPAWN_MS;
    this.resetPlayerInputState(player);
    this.exitHoldStartedAt = null;
    this.activeExitId = null;
  }

  private checkLevelComplete(now: number): void {
    if (this.phase !== ROOM_PHASES.playing || !this.currentLevel || this.playersBySessionId.size < this.maxClients) {
      this.exitHoldStartedAt = null;
      this.activeExitId = null;
      return;
    }

    const playerRects = Array.from(this.playersBySessionId.values())
      .filter((player) => player.connected && player.alive)
      .map((player) => this.getPlayerRect(player));

    for (const exit of this.currentLevel.exits) {
      const requiredPlayers = exit.requiresBothPlayers ? 2 : 1;
      const playersInExit = playerRects.filter((playerRect) => rectsOverlap(playerRect, exit.rect)).length;

      if (playersInExit >= requiredPlayers) {
        if (this.activeExitId !== exit.id) {
          this.activeExitId = exit.id;
          this.exitHoldStartedAt = now;
        }

        if (this.exitHoldStartedAt !== null && now - this.exitHoldStartedAt >= (exit.holdMs ?? defaultExitHoldMs)) {
          this.completeCurrentLevel(now);
        }

        return;
      }
    }

    this.exitHoldStartedAt = null;
    this.activeExitId = null;
  }

  private completeCurrentLevel(completeTimeMs: number): void {
    if (!this.currentLevel || this.pendingLevelAdvance) {
      return;
    }

    const completedLevel = this.currentLevel;
    const nextLevel = this.levels[this.currentLevelIndex + 1] ?? null;

    this.pendingLevelAdvance = true;
    this.phase = ROOM_PHASES.levelComplete;
    this.restartVotes = {};
    this.broadcast("level_complete", {
      type: "level_complete",
      levelId: completedLevel.id,
      nextLevelId: nextLevel?.id ?? null,
      completeTimeMs,
    });
    void this.updateMetadata();
    this.broadcastRoomState();

    setTimeout(() => {
      if (this.pendingLevelAdvance && this.phase === ROOM_PHASES.levelComplete) {
        void this.advanceLevel();
      }
    }, levelAdvanceDelayMs);
  }

  private async advanceLevel(): Promise<void> {
    const nextLevelIndex = this.currentLevelIndex + 1;

    this.pendingLevelAdvance = false;
    this.exitHoldStartedAt = null;
    this.activeExitId = null;
    this.restartVotes = {};

    if (nextLevelIndex >= this.levels.length) {
      this.phase = ROOM_PHASES.finished;
      await this.updateMetadata();
      this.broadcastRoomState();
      return;
    }

    this.phase = this.playersBySessionId.size === this.maxClients ? ROOM_PHASES.playing : ROOM_PHASES.waiting;
    this.initializeLevel(nextLevelIndex);
    this.respawnPlayers();
    this.updateLevelMechanics(Date.now());
    await this.updateMetadata();
    this.broadcastLevelStart();
    this.broadcastRoomState();
  }

  private async restartCurrentLevel(): Promise<void> {
    this.pendingLevelAdvance = false;
    this.exitHoldStartedAt = null;
    this.activeExitId = null;
    this.restartVotes = {};
    this.initializeLevel(this.currentLevelIndex);
    this.respawnPlayers();
    this.phase = this.allPlayersReady() ? ROOM_PHASES.playing : ROOM_PHASES.readyCheck;
    this.updateLevelMechanics(Date.now());
    await this.updateMetadata();
    this.broadcastLevelStart();
    this.broadcastRoomState();
  }

  private initializeLevel(levelIndex: number): void {
    const level = this.levels[levelIndex];

    if (!level) {
      throw new Error(`Missing level at index ${levelIndex}`);
    }

    this.currentLevelIndex = levelIndex;
    this.currentLevel = level;
    this.buttonRuntime.clear();
    this.movingRuntime.clear();
    this.trapRuntime.clear();

    for (const platform of level.platforms) {
      if (platform.type === "moving") {
        this.movingRuntime.set(platform.id, createPathRuntime(platform.rect));
      }
    }

    for (const trap of level.traps) {
      if (trap.type === "crusher") {
        this.trapRuntime.set(trap.id, createPathRuntime(trap.rect));
      }
    }

    this.updateLevelMechanics(Date.now());
  }

  private respawnPlayers(): void {
    for (const player of this.playersBySessionId.values()) {
      const spawn = this.getSpawn(player.playerIndex);

      player.x = spawn.x;
      player.y = spawn.y;
      player.vx = 0;
      player.vy = 0;
      player.facing = spawn.facing ?? 1;
      player.grounded = true;
      player.alive = true;
      player.respawnAt = 0;
      this.resetPlayerInputState(player);
    }
  }

  private getSpawn(playerIndex: 0 | 1): { x: number; y: number; facing?: -1 | 1 } {
    const spawn = this.currentLevel?.players.find((playerSpawn) => playerSpawn.playerIndex === playerIndex);

    if (spawn) {
      return spawn;
    }

    return playerIndex === 0 ? { x: 180, y: 336, facing: 1 } : { x: 260, y: 336, facing: 1 };
  }

  private playerCollidesHorizontally(player: PlayerRecord): boolean {
    return this.findHorizontalCollision(player) !== null;
  }

  private findHorizontalCollision(player: PlayerRecord): (CollisionRect & { id?: string }) | null {
    const playerRect = this.getPlayerRect(player);

    for (const collision of this.getSolidCollisionRectsWithIds()) {
      if (rectsOverlap(playerRect, collision.rect)) {
        return collision;
      }
    }

    return null;
  }

  private resolveVerticalCollisions(player: PlayerRecord, previousY: number, wantsDropThrough: boolean): void {
    const playerRect = this.getPlayerRect(player);
    const previousBottom = previousY + PLAYER_SIZE;

    for (const collision of this.getSolidCollisionRects()) {
      if (!rectsOverlap(playerRect, collision.rect)) {
        continue;
      }

      if (player.vy >= 0 && previousBottom <= collision.rect.y + 6) {
        player.y = collision.rect.y - PLAYER_SIZE;
        player.vy = 0;
        player.grounded = true;
        return;
      }

      if (player.vy < 0 && previousY >= collision.rect.y + collision.rect.h - 6) {
        player.y = collision.rect.y + collision.rect.h;
        player.vy = 0;
        return;
      }
    }

    if (player.vy < 0 || wantsDropThrough) {
      return;
    }

    const currentRect = this.getPlayerRect(player);

    for (const collision of this.getOneWayCollisionRects()) {
      if (previousBottom <= collision.rect.y + 6 && rectsOverlap(currentRect, collision.rect)) {
        player.y = collision.rect.y - PLAYER_SIZE;
        player.vy = 0;
        player.grounded = true;
        return;
      }
    }
  }

  private getSolidCollisionRectsWithIds(): Array<CollisionRect & { id?: string }> {
    if (!this.currentLevel) {
      return [];
    }

    return [
      ...this.currentLevel.platforms
        .filter((platform) => platform.type === "solid" || platform.type === "moving")
        .map((platform) => ({
          id: platform.id,
          rect: this.getPlatformRect(platform),
          oneWay: false,
        })),
      ...this.currentLevel.doors
        .filter((door) => !this.doors[door.id]?.open)
        .map((door) => ({
          id: door.id,
          rect: door.rect,
          oneWay: false,
        })),
    ];
  }

  private getSolidCollisionRects(): CollisionRect[] {
    return this.getSolidCollisionRectsWithIds().map(({ rect, oneWay }) => ({ rect, oneWay }));
  }

  private getOneWayCollisionRects(): CollisionRect[] {
    if (!this.currentLevel) {
      return [];
    }

    return this.currentLevel.platforms
      .filter((platform) => platform.type === "oneWay")
      .map((platform) => ({
        rect: this.getPlatformRect(platform),
        oneWay: true,
      }));
  }

  private getPlatformRect(platform: PlatformDefinition): Rect {
    const state = this.movingPlatforms[platform.id];

    if (platform.type === "moving" && state) {
      return {
        ...platform.rect,
        x: state.x,
        y: state.y,
      };
    }

    return platform.rect;
  }

  private getTrapRect(trap: TrapDefinition): Rect {
    const state = this.traps[trap.id];

    if (state) {
      return {
        ...trap.rect,
        x: state.x,
        y: state.y,
      };
    }

    return trap.rect;
  }

  private getAlivePlayerActors(): ActorRect[] {
    return Array.from(this.playersBySessionId.values())
      .filter((player) => player.connected && player.alive)
      .map((player) => ({
        id: player.role,
        rect: this.getPlayerRect(player),
      }));
  }

  private getPlayerRect(player: PlayerRecord): Rect {
    return {
      x: player.x,
      y: player.y,
      w: PLAYER_SIZE,
      h: PLAYER_SIZE,
    };
  }

  private broadcastLevelStart(): void {
    if (!this.currentLevel) {
      return;
    }

    this.broadcast("level_start", {
      type: "level_start",
      levelId: this.currentLevel.id,
      levelIndex: this.currentLevelIndex,
      level: this.currentLevel,
      serverTime: Date.now(),
    });
  }

  private broadcastRoomState(): void {
    this.broadcast("room_state", this.createRoomState());
  }

  private createRoomState(): RoomStateMessage {
    const players: RoomStateMessage["players"] = {};

    for (const player of this.playersBySessionId.values()) {
      players[player.role] = {
        sessionId: player.sessionId,
        playerIndex: player.playerIndex,
        role: player.role,
        name: player.name,
        connected: player.connected,
        ready: player.ready,
        x: player.x,
        y: player.y,
        vx: player.vx,
        vy: player.vy,
        facing: player.facing,
        grounded: player.grounded,
        alive: player.alive,
        respawnAt: player.respawnAt,
        lastProcessedInputSeq: player.lastProcessedInputSeq,
      };
    }

    return {
      phase: this.phase,
      roomCode: this.roomId,
      levelId: this.currentLevel?.id ?? null,
      levelIndex: this.currentLevelIndex,
      serverTime: Date.now(),
      players,
      buttons: this.buttons,
      doors: this.doors,
      traps: this.traps,
      movingPlatforms: this.movingPlatforms,
      restartVotes: this.restartVotes,
    };
  }

  private async updateMetadata(): Promise<void> {
    await this.setMetadata({
      phase: this.phase,
      protocolVersion: PROTOCOL_VERSION,
      roomCode: this.roomId,
      playerCount: this.playersBySessionId.size,
      levelId: this.currentLevel?.id ?? null,
      levelIndex: this.currentLevelIndex,
    });
  }
}

function applyTargetOverride(target: TargetAction, level: LevelSchema, overrides: MechanismOverrides): void {
  if (level.doors.some((door) => door.id === target.targetId)) {
    if (target.action === "open") {
      overrides.doors.set(target.targetId, true);
    } else if (target.action === "close") {
      overrides.doors.set(target.targetId, false);
    } else if (target.action === "toggle") {
      const door = level.doors.find((candidate) => candidate.id === target.targetId);
      overrides.doors.set(target.targetId, !(door?.startsOpen ?? false));
    }
  }

  if (level.traps.some((trap) => trap.id === target.targetId)) {
    if (target.action === "enable" || target.action === "start") {
      overrides.traps.set(target.targetId, true);
    } else if (target.action === "disable" || target.action === "stop") {
      overrides.traps.set(target.targetId, false);
    } else if (target.action === "toggle") {
      const trap = level.traps.find((candidate) => candidate.id === target.targetId);
      overrides.traps.set(target.targetId, !(trap?.enabledByDefault ?? false));
    }
  }

  if (level.platforms.some((platform) => platform.id === target.targetId && platform.type === "moving")) {
    if (target.action === "enable" || target.action === "start" || target.action === "open") {
      overrides.movingPlatforms.set(target.targetId, true);
    } else if (target.action === "disable" || target.action === "stop" || target.action === "close") {
      overrides.movingPlatforms.set(target.targetId, false);
    } else if (target.action === "toggle") {
      const platform = level.platforms.find((candidate) => candidate.id === target.targetId);
      overrides.movingPlatforms.set(target.targetId, !(platform?.activeByDefault ?? true));
    }
  }
}

function createRoomCode(): string {
  let code = "";

  for (let index = 0; index < ROOM_CODE_LENGTH; index += 1) {
    code += roomCodeAlphabet[Math.floor(Math.random() * roomCodeAlphabet.length)];
  }

  return code;
}

function sanitizePlayerName(playerName: string | undefined): string {
  const trimmedName = playerName?.trim();
  return trimmedName ? trimmedName.slice(0, 24) : "Player";
}

function createPathRuntime(rect: Rect): PathRuntime {
  return {
    x: rect.x,
    y: rect.y,
    targetIndex: 1,
    direction: 1,
  };
}

function stepPathRuntime(
  runtime: PathRuntime,
  path: readonly { x: number; y: number }[] | undefined,
  speed: number | undefined,
  deltaSeconds: number,
): { x: number; y: number } {
  const previousX = runtime.x;
  const previousY = runtime.y;

  if (!path || path.length < 2 || !speed) {
    return { x: 0, y: 0 };
  }

  const target = path[runtime.targetIndex];

  if (!target) {
    runtime.targetIndex = 0;
    return { x: 0, y: 0 };
  }

  const dx = target.x - runtime.x;
  const dy = target.y - runtime.y;
  const distance = Math.hypot(dx, dy);
  const travel = speed * deltaSeconds;

  if (distance <= travel || distance === 0) {
    runtime.x = target.x;
    runtime.y = target.y;

    if (runtime.targetIndex === path.length - 1) {
      runtime.direction = -1;
    } else if (runtime.targetIndex === 0) {
      runtime.direction = 1;
    }

    runtime.targetIndex += runtime.direction;
    return {
      x: runtime.x - previousX,
      y: runtime.y - previousY,
    };
  }

  runtime.x += (dx / distance) * travel;
  runtime.y += (dy / distance) * travel;

  return {
    x: runtime.x - previousX,
    y: runtime.y - previousY,
  };
}

function getLongestTargetDuration(targets: readonly TargetAction[], fallbackMs: number): number {
  return targets.reduce((longest, target) => Math.max(longest, target.durationMs ?? 0), fallbackMs);
}

function isStandingOnRect(player: Rect, rect: Rect): boolean {
  const playerBottom = player.y + player.h;
  const horizontallyOverlaps = player.x < rect.x + rect.w && player.x + player.w > rect.x;

  return horizontallyOverlaps && playerBottom >= rect.y - 4 && playerBottom <= rect.y + 10;
}

function isValidReadyMessage(message: ClientReadyMessage): boolean {
  return message.type === "client_ready" && typeof message.ready === "boolean";
}

function isValidRestartVoteMessage(message: RestartVoteMessage): boolean {
  return message.type === "restart_vote" && typeof message.approve === "boolean";
}

function isValidPingMessage(message: PingMessage): boolean {
  return message.type === "ping" && Number.isFinite(message.clientTime);
}

function isValidInputMessage(message: InputMessage): boolean {
  return (
    message.type === "input" &&
    Number.isSafeInteger(message.seq) &&
    message.seq >= 0 &&
    Number.isFinite(message.clientTime) &&
    typeof message.left === "boolean" &&
    typeof message.right === "boolean" &&
    typeof message.up === "boolean" &&
    typeof message.down === "boolean" &&
    typeof message.jump === "boolean" &&
    typeof message.jumpPressed === "boolean" &&
    typeof message.interactPressed === "boolean"
  );
}

function shouldAcceptLateInput(player: PlayerRecord, message: InputMessage, now: number): boolean {
  return (
    !isNeutralInputMessage(message) &&
    player.lastProcessedInputSeq - message.seq <= maxInputReorderSeqGap &&
    now - player.lastInputAt <= maxInputReorderMs
  );
}

function isNeutralInputMessage(message: InputMessage): boolean {
  return (
    !message.left &&
    !message.right &&
    !message.up &&
    !message.down &&
    !message.jump &&
    !message.jumpPressed &&
    !message.interactPressed
  );
}

function compactInput(input: InputMessage): Record<string, unknown> {
  return {
    seq: input.seq,
    left: input.left,
    right: input.right,
    up: input.up,
    down: input.down,
    jump: input.jump,
    jumpPressed: input.jumpPressed,
    interactPressed: input.interactPressed,
  };
}

function createNeutralInput(): InputMessage {
  return {
    type: "input",
    seq: 0,
    clientTime: 0,
    left: false,
    right: false,
    up: false,
    down: false,
    jump: false,
    jumpPressed: false,
    interactPressed: false,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function normalizeDeltaMs(deltaTime: number): number {
  if (!Number.isFinite(deltaTime) || deltaTime <= 0) {
    return simulationIntervalMs;
  }

  if (deltaTime >= 1) {
    return deltaTime;
  }

  const secondsAsMs = deltaTime * 1000;

  return secondsAsMs >= 1 ? secondsAsMs : simulationIntervalMs;
}
