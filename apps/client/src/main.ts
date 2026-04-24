import { Client } from "@colyseus/sdk";
import {
  DEFAULT_CLIENT_HEIGHT,
  DEFAULT_CLIENT_WIDTH,
  INPUT_SEND_HZ,
  PLAYER_ROLES,
  PLAYER_SIZE,
  PROTOCOL_VERSION,
  ROOM_NAME,
  ROOM_PHASES,
  type InputMessage,
  type LevelSchema,
  type PlayerRole,
  type PongMessage,
  type RoomStateMessage,
} from "@coop-game/shared";
import Phaser from "phaser";

import "./styles.css";

type DirectionInput = Pick<
  InputMessage,
  "left" | "right" | "up" | "down" | "jump" | "jumpPressed" | "interactPressed"
>;

const serverUrl = import.meta.env.VITE_SERVER_URL ?? `http://${window.location.hostname}:2567`;
const client = new Client(serverUrl);

type GameRoom = Awaited<ReturnType<typeof client.create>>;

let activeRoom: GameRoom | null = null;
let myRole: PlayerRole | null = null;
let inputSeq = 0;
let inputLoopId: number | null = null;
let pingLoopId: number | null = null;
let readySent = false;
let restartRequested = false;
let latestPingMs: number | null = null;
let latestRoomState: RoomStateMessage = {
  phase: ROOM_PHASES.waiting,
  roomCode: "----",
  levelId: null,
  levelIndex: 0,
  level: null,
  serverTime: 0,
  players: {},
  buttons: {},
  doors: {},
  traps: {},
  movingPlatforms: {},
  restartVotes: {},
};
let readDirectionInput: (() => DirectionInput) | null = null;

const createRoomButton = getElement<HTMLButtonElement>("create-room-button");
const readyButton = getElement<HTMLButtonElement>("ready-button");
const restartButton = getElement<HTMLButtonElement>("restart-button");
const joinRoomForm = getElement<HTMLFormElement>("join-room-form");
const roomCodeInput = getElement<HTMLInputElement>("room-code-input");
const homePanel = getElement<HTMLElement>("home-panel");
const roomCodeLabel = getElement<HTMLElement>("room-code-label");
const roleLabel = getElement<HTMLElement>("role-label");
const statusLabel = getElement<HTMLElement>("status-label");
const levelLabel = getElement<HTMLElement>("level-label");
const pingLabel = getElement<HTMLElement>("ping-label");

class GameScene extends Phaser.Scene {
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: Record<"left" | "right" | "up" | "down", Phaser.Input.Keyboard.Key>;
  private jumpKey!: Phaser.Input.Keyboard.Key;
  private interactKey!: Phaser.Input.Keyboard.Key;
  private playerViews!: Record<PlayerRole, Phaser.GameObjects.Rectangle>;
  private roleLabels!: Record<PlayerRole, Phaser.GameObjects.Text>;
  private renderedLevelId: string | null = null;
  private levelObjects: Phaser.GameObjects.GameObject[] = [];
  private buttonViews: Record<string, Phaser.GameObjects.Rectangle> = {};
  private doorViews: Record<string, Phaser.GameObjects.Rectangle> = {};
  private trapViews: Record<string, Phaser.GameObjects.Rectangle> = {};
  private movingPlatformViews: Record<string, Phaser.GameObjects.Rectangle> = {};

  public constructor() {
    super("GameScene");
  }

  public create(): void {
    const keyboard = this.input.keyboard;

    if (!keyboard) {
      throw new Error("Keyboard input is unavailable.");
    }

    this.cursors = keyboard.createCursorKeys();
    this.wasd = keyboard.addKeys({
      left: Phaser.Input.Keyboard.KeyCodes.A,
      right: Phaser.Input.Keyboard.KeyCodes.D,
      up: Phaser.Input.Keyboard.KeyCodes.W,
      down: Phaser.Input.Keyboard.KeyCodes.S,
    }) as Record<"left" | "right" | "up" | "down", Phaser.Input.Keyboard.Key>;
    this.jumpKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.interactKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.E);

    this.add.rectangle(0, 0, DEFAULT_CLIENT_WIDTH, DEFAULT_CLIENT_HEIGHT, 0x0f172a).setOrigin(0).setDepth(-10);
    this.add
      .rectangle(32, 32, DEFAULT_CLIENT_WIDTH - 64, DEFAULT_CLIENT_HEIGHT - 64)
      .setOrigin(0)
      .setStrokeStyle(2, 0x334155)
      .setDepth(-1);

    this.add
      .text(DEFAULT_CLIENT_WIDTH / 2, DEFAULT_CLIENT_HEIGHT - 44, "WASD / Arrow Keys · Space Jump · E Interact", {
        color: "#64748b",
        fontFamily: "Arial, sans-serif",
        fontSize: "16px",
      })
      .setOrigin(0.5)
      .setDepth(2);

    this.playerViews = {
      [PLAYER_ROLES.A]: this.createPlayerView(PLAYER_ROLES.A, 0x38bdf8),
      [PLAYER_ROLES.B]: this.createPlayerView(PLAYER_ROLES.B, 0xf97316),
    };

    this.roleLabels = {
      [PLAYER_ROLES.A]: this.createRoleLabel(PLAYER_ROLES.A),
      [PLAYER_ROLES.B]: this.createRoleLabel(PLAYER_ROLES.B),
    };

    readDirectionInput = () => this.readInput();
  }

  public update(): void {
    if (latestRoomState.level?.id !== this.renderedLevelId) {
      this.renderLevel(latestRoomState.level);
    }

    this.syncMechanismViews();

    for (const role of Object.values(PLAYER_ROLES)) {
      const player = latestRoomState.players[role];
      const view = this.playerViews[role];
      const label = this.roleLabels[role];

      if (!player) {
        view.setVisible(false);
        label.setVisible(false);
        continue;
      }

      view.setVisible(true);
      label.setVisible(true);
      view.setPosition(player.x + PLAYER_SIZE / 2, player.y + PLAYER_SIZE / 2);
      view.setAlpha(player.alive ? (role === myRole ? 1 : 0.72) : 0.28);
      label.setText(role === myRole ? `${role} YOU` : role);
      label.setPosition(player.x + PLAYER_SIZE / 2, player.y - 12);
    }
  }

  private createPlayerView(role: PlayerRole, color: number): Phaser.GameObjects.Rectangle {
    const view = this.add.rectangle(0, 0, PLAYER_SIZE, PLAYER_SIZE, color).setVisible(false).setDepth(10);
    view.setStrokeStyle(3, role === PLAYER_ROLES.A ? 0xe0f2fe : 0xffedd5);
    return view;
  }

  private createRoleLabel(role: PlayerRole): Phaser.GameObjects.Text {
    return this.add
      .text(0, 0, role, {
        color: "#f8fafc",
        fontFamily: "Arial, sans-serif",
        fontSize: "14px",
        fontStyle: "700",
      })
      .setOrigin(0.5)
      .setDepth(11)
      .setVisible(false);
  }

  private renderLevel(level: LevelSchema | null): void {
    for (const object of this.levelObjects) {
      object.destroy();
    }

    this.levelObjects = [];
    this.buttonViews = {};
    this.doorViews = {};
    this.trapViews = {};
    this.movingPlatformViews = {};
    this.renderedLevelId = level?.id ?? null;

    if (!level) {
      return;
    }

    this.levelObjects.push(
      this.add
        .rectangle(0, 0, level.world.width, level.world.height, 0x111827)
        .setOrigin(0)
        .setDepth(-5),
    );

    for (const spawn of level.players) {
      this.levelObjects.push(
        this.add
          .rectangle(spawn.x, spawn.y, PLAYER_SIZE, PLAYER_SIZE, spawn.playerIndex === 0 ? 0x075985 : 0x9a3412, 0.2)
          .setOrigin(0)
          .setStrokeStyle(1, spawn.playerIndex === 0 ? 0x38bdf8 : 0xf97316)
          .setDepth(1),
      );
    }

    for (const platform of level.platforms) {
      const view = this.add
        .rectangle(platform.rect.x, platform.rect.y, platform.rect.w, platform.rect.h, getPlatformColor(platform.type))
        .setOrigin(0)
        .setStrokeStyle(1, 0x64748b)
        .setDepth(1);

      if (platform.type === "moving") {
        this.movingPlatformViews[platform.id] = view;
      }

      this.levelObjects.push(view);
    }

    for (const button of level.buttons) {
      const view = this.add
        .rectangle(button.rect.x, button.rect.y, button.rect.w, button.rect.h, 0x854d0e)
        .setOrigin(0)
        .setStrokeStyle(2, 0xfacc15)
        .setDepth(2);

      this.buttonViews[button.id] = view;
      this.levelObjects.push(view);
    }

    for (const door of level.doors) {
      const view = this.add
        .rectangle(door.rect.x, door.rect.y, door.rect.w, door.rect.h, getDoorColor(door.colorKey))
        .setOrigin(0)
        .setStrokeStyle(2, 0xf8fafc)
        .setDepth(3);

      this.doorViews[door.id] = view;
      this.levelObjects.push(view);
    }

    for (const exit of level.exits) {
      const view = this.add
        .rectangle(exit.rect.x, exit.rect.y, exit.rect.w, exit.rect.h, 0x14532d, 0.35)
        .setOrigin(0)
        .setStrokeStyle(3, 0x22c55e)
        .setDepth(1);

      this.levelObjects.push(view);
    }

    for (const trap of level.traps) {
      const view = this.add
        .rectangle(trap.rect.x, trap.rect.y, trap.rect.w, trap.rect.h, getTrapColor(trap.type))
        .setOrigin(0)
        .setStrokeStyle(2, 0xfca5a5)
        .setDepth(4);

      this.trapViews[trap.id] = view;
      this.levelObjects.push(view);
    }
  }

  private syncMechanismViews(): void {
    for (const [buttonId, view] of Object.entries(this.buttonViews)) {
      const buttonState = latestRoomState.buttons[buttonId];
      view.setFillStyle(buttonState?.active ? 0xfacc15 : 0x854d0e, buttonState?.active ? 1 : 0.75);
    }

    for (const [doorId, view] of Object.entries(this.doorViews)) {
      const doorState = latestRoomState.doors[doorId];
      const isOpen = doorState?.open ?? false;

      view.setAlpha(isOpen ? 0.25 : 1);
      view.setVisible(true);
    }

    for (const [trapId, view] of Object.entries(this.trapViews)) {
      const trapState = latestRoomState.traps[trapId];

      if (trapState) {
        view.setPosition(trapState.x, trapState.y);
      }

      view.setAlpha(trapState?.active ? 1 : 0.25);
    }

    for (const [platformId, view] of Object.entries(this.movingPlatformViews)) {
      const platformState = latestRoomState.movingPlatforms[platformId];

      if (platformState) {
        view.setPosition(platformState.x, platformState.y);
        view.setAlpha(platformState.active ? 1 : 0.55);
      }
    }
  }

  private readInput(): DirectionInput {
    const jumpPressed = Phaser.Input.Keyboard.JustDown(this.jumpKey) || Boolean(this.cursors.space && Phaser.Input.Keyboard.JustDown(this.cursors.space));
    const upPressed = this.wasd.up.isDown || Boolean(this.cursors.up?.isDown);

    return {
      left: this.wasd.left.isDown || Boolean(this.cursors.left?.isDown),
      right: this.wasd.right.isDown || Boolean(this.cursors.right?.isDown),
      up: upPressed,
      down: this.wasd.down.isDown || Boolean(this.cursors.down?.isDown),
      jump: this.jumpKey.isDown || Boolean(this.cursors.space?.isDown),
      jumpPressed,
      interactPressed: Phaser.Input.Keyboard.JustDown(this.interactKey),
    };
  }
}

const gameConfig: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: "game",
  width: DEFAULT_CLIENT_WIDTH,
  height: DEFAULT_CLIENT_HEIGHT,
  backgroundColor: "#0f172a",
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [GameScene],
};

new Phaser.Game(gameConfig);

createRoomButton.addEventListener("click", () => {
  void createRoom();
});

readyButton.addEventListener("click", () => {
  sendReady();
});

restartButton.addEventListener("click", () => {
  sendRestartVote();
});

joinRoomForm.addEventListener("submit", (event) => {
  event.preventDefault();
  void joinRoom();
});

async function createRoom(): Promise<void> {
  await leaveActiveRoom();
  setBusy(true);
  setStatus("Creating room...");

  try {
    const nextRoom = await client.create<unknown>(ROOM_NAME, createJoinOptions());
    attachRoom(nextRoom);
  } catch (error) {
    setStatus(getErrorMessage(error), true);
    setBusy(false);
  }
}

async function joinRoom(): Promise<void> {
  const roomCode = normalizeRoomCode(roomCodeInput.value);

  if (roomCode.length !== 4) {
    setStatus("Enter a 4-character room code.", true);
    return;
  }

  await leaveActiveRoom();
  setBusy(true);
  setStatus("Joining room...");

  try {
    const nextRoom = await client.joinById<unknown>(roomCode, createJoinOptions());
    attachRoom(nextRoom);
  } catch (error) {
    setStatus(getErrorMessage(error), true);
    setBusy(false);
  }
}

function attachRoom(nextRoom: GameRoom): void {
  activeRoom = nextRoom;
  myRole = null;
  inputSeq = 0;
  readySent = false;
  restartRequested = false;
  latestPingMs = null;
  roomCodeLabel.textContent = nextRoom.roomId;
  roleLabel.textContent = "-";
  homePanel.classList.add("connected");
  setStatus("Waiting for room state...");
  setBusy(false);

  nextRoom.onMessage("room_state", (message: RoomStateMessage) => {
    latestRoomState = message;
    updateHudFromState(message);
  });

  nextRoom.onMessage("pong", (message: PongMessage) => {
    latestPingMs = Math.max(0, Date.now() - message.clientTime);
    pingLabel.textContent = `${latestPingMs}ms`;
  });

  nextRoom.onLeave(() => {
    stopInputLoop();
    stopPingLoop();
    activeRoom = null;
    myRole = null;
    latestRoomState = {
      phase: ROOM_PHASES.waiting,
      roomCode: "----",
      levelId: null,
      levelIndex: 0,
      level: null,
      serverTime: 0,
      players: {},
      buttons: {},
      doors: {},
      traps: {},
      movingPlatforms: {},
      restartVotes: {},
    };
    updateHudFromState(latestRoomState);
    homePanel.classList.remove("connected");
    updateActionButtons();
    setStatus("Disconnected.");
  });

  nextRoom.onError((code: number, message?: string) => {
    setStatus(`${code}: ${message ?? "Room error"}`, true);
  });

  startInputLoop();
  startPingLoop();
}

function startInputLoop(): void {
  stopInputLoop();

  inputLoopId = window.setInterval(() => {
    if (!activeRoom || !myRole || latestRoomState.phase !== ROOM_PHASES.playing || !readDirectionInput) {
      return;
    }

    const directionInput = readDirectionInput();
    const inputMessage: InputMessage = {
      type: "input",
      seq: ++inputSeq,
      clientTime: Date.now(),
      ...directionInput,
    };

    activeRoom.send("input", inputMessage);
  }, 1000 / INPUT_SEND_HZ);
}

function stopInputLoop(): void {
  if (inputLoopId !== null) {
    window.clearInterval(inputLoopId);
    inputLoopId = null;
  }
}

function startPingLoop(): void {
  stopPingLoop();

  pingLoopId = window.setInterval(() => {
    if (!activeRoom) {
      return;
    }

    activeRoom.send("ping", {
      type: "ping",
      clientTime: Date.now(),
    });
  }, 2000);
}

function stopPingLoop(): void {
  if (pingLoopId !== null) {
    window.clearInterval(pingLoopId);
    pingLoopId = null;
  }
}

function sendReady(): void {
  if (!activeRoom || readySent) {
    return;
  }

  readySent = true;
  activeRoom.send("client_ready", {
    type: "client_ready",
    ready: true,
  });
  updateActionButtons();
}

function sendRestartVote(): void {
  if (!activeRoom || !myRole || restartRequested) {
    return;
  }

  restartRequested = true;
  activeRoom.send("restart_vote", {
    type: "restart_vote",
    approve: true,
  });
  updateActionButtons();
}

async function leaveActiveRoom(): Promise<void> {
  if (!activeRoom) {
    return;
  }

  stopInputLoop();
  stopPingLoop();
  const roomToLeave = activeRoom;
  activeRoom = null;
  await roomToLeave.leave(true);
}

function updateHudFromState(message: RoomStateMessage): void {
  syncMyRoleFromState(message);

  roomCodeLabel.textContent = message.roomCode;
  roleLabel.textContent = myRole ?? "-";
  levelLabel.textContent = message.levelId ? `${message.levelIndex + 1}: ${message.levelId}` : "-";
  pingLabel.textContent = latestPingMs === null ? "-" : `${latestPingMs}ms`;

  if (myRole && message.players[myRole]?.ready) {
    readySent = true;
  }

  if (myRole && !message.restartVotes[myRole]) {
    restartRequested = false;
  }

  updateActionButtons();

  if (message.phase === ROOM_PHASES.playing) {
    const playerCount = Object.keys(message.players).length;
    setStatus(`Playing ${message.levelId ?? "level"} (${playerCount}/2)`);
    return;
  }

  if (message.phase === ROOM_PHASES.readyCheck) {
    const readyCount = Object.values(message.players).filter((player) => player?.ready).length;
    setStatus(`Ready check (${readyCount}/2)`);
    return;
  }

  if (message.phase === ROOM_PHASES.levelComplete) {
    setStatus(`${message.levelId ?? "Level"} complete`);
    return;
  }

  if (message.phase === ROOM_PHASES.finished) {
    setStatus("Finished");
    return;
  }

  const playerCount = Object.keys(message.players).length;
  setStatus(`Waiting for players (${playerCount}/2)`);
}

function syncMyRoleFromState(message: RoomStateMessage): void {
  if (!activeRoom || myRole) {
    return;
  }

  for (const player of Object.values(message.players)) {
    if (player?.sessionId === activeRoom.sessionId) {
      myRole = player.role;
      break;
    }
  }
}

function updateActionButtons(): void {
  const ownPlayer = myRole ? latestRoomState.players[myRole] : null;
  const canReady =
    Boolean(activeRoom) &&
    Boolean(ownPlayer) &&
    !readySent &&
    (latestRoomState.phase === ROOM_PHASES.waiting || latestRoomState.phase === ROOM_PHASES.readyCheck);
  const canRestart =
    Boolean(activeRoom) &&
    Boolean(myRole) &&
    !restartRequested &&
    (latestRoomState.phase === ROOM_PHASES.playing || latestRoomState.phase === ROOM_PHASES.levelComplete);

  readyButton.disabled = !canReady;
  restartButton.disabled = !canRestart;
  readyButton.textContent = readySent ? "Ready OK" : "Ready";
  restartButton.textContent = restartRequested ? "Restart OK" : "Restart";
}

function createJoinOptions(): { playerName: string; clientVersion: string } {
  return {
    playerName: "Player",
    clientVersion: PROTOCOL_VERSION,
  };
}

function setBusy(isBusy: boolean): void {
  createRoomButton.disabled = isBusy;
  roomCodeInput.disabled = isBusy;
  readyButton.disabled = isBusy || readyButton.disabled;
  restartButton.disabled = isBusy || restartButton.disabled;
  const joinButton = joinRoomForm.querySelector<HTMLButtonElement>("button");

  if (joinButton) {
    joinButton.disabled = isBusy;
  }
}

function setStatus(message: string, isError = false): void {
  statusLabel.textContent = message;
  statusLabel.classList.toggle("error", isError);
}

function normalizeRoomCode(value: string): string {
  return value.trim().toUpperCase();
}

function getDoorColor(colorKey: string | undefined): number {
  switch (colorKey) {
    case "blue":
      return 0x2563eb;
    case "orange":
      return 0xf97316;
    case "red":
      return 0xdc2626;
    default:
      return 0x7c3aed;
  }
}

function getPlatformColor(type: string): number {
  switch (type) {
    case "oneWay":
      return 0x475569;
    case "moving":
      return 0x0f766e;
    default:
      return 0x334155;
  }
}

function getTrapColor(type: string): number {
  switch (type) {
    case "laser":
      return 0xef4444;
    case "crusher":
      return 0x991b1b;
    default:
      return 0xb91c1c;
  }
}

function getElement<TElement extends HTMLElement>(id: string): TElement {
  const element = document.getElementById(id);

  if (!element) {
    throw new Error(`Missing element #${id}`);
  }

  return element as TElement;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return "Request failed.";
}
