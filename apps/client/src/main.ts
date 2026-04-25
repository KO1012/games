import { Client } from "@colyseus/sdk";
import {
  DEFAULT_CLIENT_HEIGHT,
  DEFAULT_CLIENT_WIDTH,
  INPUT_SEND_HZ,
  PROTOCOL_VERSION,
  ROOM_NAME,
  ROOM_PHASES,
  type PlayerRole,
  type PongMessage,
  type RoomJoinedMessage,
  type RoomStateMessage,
  type LevelStartMessage,
} from "@coop-game/shared";
import Phaser from "phaser";

import { unlockAudio } from "./audio/SoundManager.js";
import {
  isNeutralDirectionInput,
  KeyboardInputBuffer,
  normalizeGameKeyCode,
  type DirectionInput,
} from "./input.js";
import { GameScene } from "./scenes/GameScene.js";
import type { GameState } from "./state.js";
import "./styles.css";

// ── Networking ───────────────────────────────────────────────────

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
let lastSentInput: DirectionInput | null = null;
const keyboardInput = new KeyboardInputBuffer();
let latestRoomState: GameState = {
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

// ── DOM elements ─────────────────────────────────────────────────

const createRoomButton = getElement<HTMLButtonElement>("create-room-button");
const readyButton = getElement<HTMLButtonElement>("ready-button");
const restartButton = getElement<HTMLButtonElement>("restart-button");
const joinRoomForm = getElement<HTMLFormElement>("join-room-form");
const roomCodeInput = getElement<HTMLInputElement>("room-code-input");
const gameContainer = getElement<HTMLElement>("game");
const homePanel = getElement<HTMLElement>("home-panel");
const roomCodeLabel = getElement<HTMLElement>("room-code-label");
const roleLabel = getElement<HTMLElement>("role-label");
const statusLabel = getElement<HTMLElement>("status-label");
const levelLabel = getElement<HTMLElement>("level-label");
const pingLabel = getElement<HTMLElement>("ping-label");

// ── Keyboard capturing ──────────────────────────────────────────

window.addEventListener("keydown", handleGameKeyDown, { capture: true });
window.addEventListener("keyup", handleGameKeyUp, { capture: true });

window.addEventListener("blur", () => clearBufferedInput());
document.addEventListener("visibilitychange", () => {
  if (document.hidden) clearBufferedInput();
});
gameContainer.tabIndex = -1;
gameContainer.addEventListener("pointerdown", () => focusGameControls());

// ── Phaser game ──────────────────────────────────────────────────

const gameScene = new GameScene();
syncSceneState();

const gameConfig: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: "game",
  width: DEFAULT_CLIENT_WIDTH,
  height: DEFAULT_CLIENT_HEIGHT,
  backgroundColor: "#0b0e1a",
  input: {
    keyboard: false, // Keyboard handled at window level by KeyboardInputBuffer
  },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [gameScene],
};

new Phaser.Game(gameConfig);

// ── UI events ────────────────────────────────────────────────────

createRoomButton.addEventListener("click", () => {
  unlockAudio();
  void createRoom();
});

readyButton.addEventListener("click", () => {
  unlockAudio();
  sendReady();
});

restartButton.addEventListener("click", () => {
  unlockAudio();
  sendRestartVote();
});

joinRoomForm.addEventListener("submit", (event) => {
  event.preventDefault();
  unlockAudio();
  void joinRoom();
});

// ── Room lifecycle ───────────────────────────────────────────────

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
  lastSentInput = null;
  keyboardInput.clear();
  roomCodeLabel.textContent = nextRoom.roomId;
  roleLabel.textContent = "-";
  homePanel.classList.add("connected");
  syncSceneState();
  setStatus("Waiting for room state...");
  blurActiveControl();
  focusGameControls();
  setBusy(false);

  nextRoom.onMessage("room_joined", (message: RoomJoinedMessage) => {
    myRole = message.role;
    roomCodeLabel.textContent = message.roomCode;
    roleLabel.textContent = message.role;
    syncSceneState();
    updateActionButtons();
  });

  nextRoom.onMessage("room_state", (message: RoomStateMessage) => {
    latestRoomState = { ...message, level: latestRoomState.level };
    updateHudFromState(message);
  });

  nextRoom.onMessage("level_start", (message: LevelStartMessage) => {
    latestRoomState.level = message.level;
    syncSceneState();
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
    lastSentInput = null;
    keyboardInput.clear();
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

// ── Input loop ───────────────────────────────────────────────────

function startInputLoop(): void {
  stopInputLoop();
  inputLoopId = window.setInterval(() => sendCurrentInput(), 1000 / INPUT_SEND_HZ);
}

function stopInputLoop(): void {
  if (inputLoopId !== null) {
    window.clearInterval(inputLoopId);
    inputLoopId = null;
  }
}

function sendCurrentInput(inputOverride: DirectionInput | null = null): void {
  if (!activeRoom || !myRole || !canSendGameplayInput()) return;
  const nextInput = inputOverride ?? readCurrentInput();

  if (
    isNeutralDirectionInput(nextInput) &&
    (lastSentInput === null || isNeutralDirectionInput(lastSentInput))
  ) {
    return;
  }

  const input = {
    type: "input",
    seq: ++inputSeq,
    clientTime: Date.now(),
    ...nextInput,
  };
  lastSentInput = nextInput;
  activeRoom.send("input", input);
}

function clearBufferedInput(): void {
  keyboardInput.clear();
  sendCurrentInput(keyboardInput.snapshot(null));
}

function readCurrentInput(): DirectionInput {
  return keyboardInput.snapshot(null);
}

function handleGameKeyDown(event: KeyboardEvent): void {
  const code = normalizeGameKeyCode(event.code, event.key);

  if (!code) return;

  if (canSendGameplayInput()) {
    event.preventDefault();
    event.stopPropagation();
  }

  if (keyboardInput.handleKeyDown(code, event.repeat)) {
    sendCurrentInput();
  }
}

function handleGameKeyUp(event: KeyboardEvent): void {
  const code = normalizeGameKeyCode(event.code, event.key);

  if (!code) return;
  if (canSendGameplayInput()) {
    event.preventDefault();
    event.stopPropagation();
  }

  if (keyboardInput.handleKeyUp(code)) {
    sendCurrentInput();
  }
}

// ── Ping loop ────────────────────────────────────────────────────

function startPingLoop(): void {
  stopPingLoop();
  pingLoopId = window.setInterval(() => {
    if (!activeRoom) return;
    activeRoom.send("ping", { type: "ping", clientTime: Date.now() });
  }, 2000);
}

function stopPingLoop(): void {
  if (pingLoopId !== null) {
    window.clearInterval(pingLoopId);
    pingLoopId = null;
  }
}

// ── Room actions ─────────────────────────────────────────────────

function sendReady(): void {
  if (!activeRoom || readySent) return;
  readySent = true;
  activeRoom.send("client_ready", { type: "client_ready", ready: true });
  blurActiveControl();
  focusGameControls();
  updateActionButtons();
}

function sendRestartVote(): void {
  if (!activeRoom || !myRole || restartRequested) return;
  restartRequested = true;
  activeRoom.send("restart_vote", { type: "restart_vote", approve: true });
  blurActiveControl();
  focusGameControls();
  updateActionButtons();
}

async function leaveActiveRoom(): Promise<void> {
  if (!activeRoom) return;
  stopInputLoop();
  stopPingLoop();
  const roomToLeave = activeRoom;
  activeRoom = null;
  await roomToLeave.leave(true);
}

// ── HUD ──────────────────────────────────────────────────────────

function updateHudFromState(message: RoomStateMessage): void {
  syncMyRoleFromState(message);
  syncSceneState();

  roomCodeLabel.textContent = message.roomCode;
  roleLabel.textContent = myRole ?? "-";
  levelLabel.textContent = message.levelId ? `${message.levelIndex + 1}: ${message.levelId}` : "-";
  pingLabel.textContent = latestPingMs === null ? "-" : `${latestPingMs}ms`;

  if (myRole && message.players[myRole]?.ready) readySent = true;
  if (myRole && !message.restartVotes[myRole]) restartRequested = false;

  updateActionButtons();

  if (message.phase === ROOM_PHASES.playing) {
    const playerCount = Object.keys(message.players).length;
    setStatus(`Playing ${message.levelId ?? "level"} (${playerCount}/2)`);
    return;
  }

  if (isWarmupState(message)) {
    setStatus(`Warmup ${message.levelId ?? "level"} (1/2)`);
    return;
  }

  if (message.phase === ROOM_PHASES.readyCheck) {
    const readyCount = Object.values(message.players).filter((p) => p?.ready).length;
    setStatus(`Ready check (${readyCount}/2)`);
    return;
  }
  if (message.phase === ROOM_PHASES.levelComplete) {
    setStatus(`${message.levelId ?? "Level"} complete`);
    return;
  }
  if (message.phase === ROOM_PHASES.finished) {
    setStatus("🎮 All levels complete!");
    return;
  }

  const playerCount = Object.keys(message.players).length;
  setStatus(`Waiting for players (${playerCount}/2)`);
}

function syncMyRoleFromState(message: RoomStateMessage): void {
  if (!activeRoom || myRole) return;
  for (const player of Object.values(message.players)) {
    if (player?.sessionId === activeRoom.sessionId) {
      myRole = player.role;
      break;
    }
  }
}

function syncSceneState(): void {
  gameScene.gameState = latestRoomState;
  gameScene.myRole = myRole;
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
  readyButton.textContent = readySent ? "READY ✓" : "READY";
  restartButton.textContent = restartRequested ? "RESTART ✓" : "RESTART";
}

function canSendGameplayInput(): boolean {
  return latestRoomState.phase === ROOM_PHASES.playing || isWarmupState(latestRoomState);
}

function isWarmupState(state: RoomStateMessage): boolean {
  return state.phase === ROOM_PHASES.waiting && Boolean(myRole) && Object.keys(state.players).length === 1;
}

// ── Utilities ────────────────────────────────────────────────────

function createJoinOptions(): { playerName: string; clientVersion: string } {
  return { playerName: "Player", clientVersion: PROTOCOL_VERSION };
}

function setBusy(isBusy: boolean): void {
  createRoomButton.disabled = isBusy;
  roomCodeInput.disabled = isBusy;
  readyButton.disabled = isBusy || readyButton.disabled;
  restartButton.disabled = isBusy || restartButton.disabled;
  const joinButton = joinRoomForm.querySelector<HTMLButtonElement>("button");
  if (joinButton) joinButton.disabled = isBusy;
}

function blurActiveControl(): void {
  if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
}

function focusGameControls(): void {
  gameContainer.focus({ preventScroll: true });
}

function setStatus(message: string, isError = false): void {
  statusLabel.textContent = message;
  statusLabel.classList.toggle("error", isError);
}

function normalizeRoomCode(value: string): string {
  return value.trim().toUpperCase();
}

function getElement<TElement extends HTMLElement>(id: string): TElement {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing element #${id}`);
  return element as TElement;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "Request failed.";
}
