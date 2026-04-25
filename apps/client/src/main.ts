import { Client } from "@colyseus/sdk";
import {
  DEFAULT_CLIENT_HEIGHT,
  DEFAULT_CLIENT_WIDTH,
  INPUT_SEND_HZ,
  PROTOCOL_VERSION,
  ROOM_NAME,
  ROOM_PHASES,
  type InputDebugMessage,
  type LevelStartMessage,
  type PlayerRole,
  type PongMessage,
  type RoomJoinedMessage,
  type RoomStateMessage,
  type SelectLevelMessage,
} from "@coop-game/shared";
import Phaser from "phaser";

import {
  getAudioPreferences,
  onAudioPreferencesChange,
  setMusicVolume,
  setSfxVolume,
  toggleMuted,
} from "./audio/preferences.js";
import { unlockAudio } from "./audio/SoundManager.js";
import {
  isNeutralDirectionInput,
  KeyboardInputBuffer,
  normalizeGameKeyCode,
  type DirectionInput,
} from "./input.js";
import { GameScene } from "./scenes/GameScene.js";
import { PreloadScene } from "./scenes/PreloadScene.js";
import type { GameState } from "./state.js";
import "./styles.css";

// ── Networking ───────────────────────────────────────────────────

const serverUrl = import.meta.env.VITE_SERVER_URL ?? `http://${window.location.hostname}:2567`;
const client = new Client(serverUrl);
const DEBUG_INPUT = new URLSearchParams(window.location.search).has("debugInput");
const reconnectTokenStorageKey = "coop-game:reconnection-token";

type GameRoom = Awaited<ReturnType<typeof client.create>>;

type ClientInputDebugEvent = {
  at: number;
  kind: string;
  code?: string;
  repeat?: boolean;
  phase: string;
  seq?: number;
  sent?: boolean;
  reason?: string;
  input?: DirectionInput;
};

const clientInputDebugEvents: ClientInputDebugEvent[] = [];
const serverInputDebugEvents: InputDebugMessage[] = [];
let latestClientInputSnapshot: DirectionInput | null = null;
let inputDebugOverlay: HTMLDivElement | null = null;

function debugClientInput(event: Omit<ClientInputDebugEvent, "at" | "phase">): void {
  if (!DEBUG_INPUT) return;

  const sample: ClientInputDebugEvent = {
    at: Date.now(),
    phase: latestRoomState.phase,
    ...event,
  };

  clientInputDebugEvents.push(sample);
  latestClientInputSnapshot = sample.input ?? latestClientInputSnapshot;

  if (clientInputDebugEvents.length > 80) {
    clientInputDebugEvents.shift();
  }

  updateInputDebugOverlay();

  window.dispatchEvent(
    new CustomEvent("coop-input-debug", {
      detail: sample,
    }),
  );

  // Keep this compact. It should be readable during rapid key presses.
  console.log("[client-input]", sample);
}

declare global {
  interface Window {
    __COOP_INPUT_DEBUG__?: ClientInputDebugEvent[];
    __COOP_SERVER_INPUT_DEBUG__?: InputDebugMessage[];
  }
}

if (DEBUG_INPUT) {
  window.__COOP_INPUT_DEBUG__ = clientInputDebugEvents;
  window.__COOP_SERVER_INPUT_DEBUG__ = serverInputDebugEvents;
}

let activeRoom: GameRoom | null = null;
let myRole: PlayerRole | null = null;
let inputSeq = 0;
let inputLoopId: number | null = null;
let pingLoopId: number | null = null;
let readySent = false;
let restartRequested = false;
let latestPingMs: number | null = null;
let lastSentInput: DirectionInput | null = null;
let roomReconnecting = false;
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
const levelSelect = getElement<HTMLSelectElement>("level-select");
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

const preloadScene = new PreloadScene();
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
  scene: [preloadScene, gameScene],
};

new Phaser.Game(gameConfig);
updateInputDebugOverlay();
setupVolumeControls();

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

levelSelect.addEventListener("change", () => {
  unlockAudio();
  sendLevelSelect();
});

joinRoomForm.addEventListener("submit", (event) => {
  event.preventDefault();
  unlockAudio();
  void joinRoom();
});
window.addEventListener("beforeunload", () => persistRoomReconnectToken());
void reconnectStoredRoom();

// ── Room lifecycle ───────────────────────────────────────────────

async function createRoom(): Promise<void> {
  await leaveActiveRoom();
  clearStoredReconnectToken();
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
  clearStoredReconnectToken();
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
  roomReconnecting = false;
  keyboardInput.clear();
  roomCodeLabel.textContent = nextRoom.roomId;
  roleLabel.textContent = "-";
  homePanel.classList.add("connected");
  syncSceneState();
  setStatus("Waiting for room state...");
  persistRoomReconnectToken(nextRoom);
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
    levelLabel.textContent = getLevelDisplayName(message.levelIndex, message.levelId);
    syncLevelSelect(message.levelIndex);
    syncSceneState();
  });

  nextRoom.onMessage("pong", (message: PongMessage) => {
    latestPingMs = Math.max(0, Date.now() - message.clientTime);
    pingLabel.textContent = `${latestPingMs}ms`;
  });

  nextRoom.onMessage("input_debug", (message: InputDebugMessage) => {
    recordServerInputDebug(message);
  });

  nextRoom.onDrop(() => {
    roomReconnecting = true;
    stopInputLoop();
    stopPingLoop();
    keyboardInput.clear();
    lastSentInput = null;
    persistRoomReconnectToken(nextRoom);
    updateActionButtons();
    setStatus("Reconnecting...");
  });

  nextRoom.onReconnect(() => {
    roomReconnecting = false;
    inputSeq = 0;
    lastSentInput = null;
    keyboardInput.clear();
    persistRoomReconnectToken(nextRoom);
    startInputLoop();
    startPingLoop();
    updateActionButtons();
    setStatus("Reconnected.");
  });

  nextRoom.onLeave(() => {
    stopInputLoop();
    stopPingLoop();
    activeRoom = null;
    myRole = null;
    lastSentInput = null;
    roomReconnecting = false;
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
    clearStoredReconnectToken();
    updateActionButtons();
    setStatus("Disconnected.");
  });

  nextRoom.onError((code: number, message?: string) => {
    setStatus(`${code}: ${message ?? "Room error"}`, true);
  });

  startInputLoop();
  startPingLoop();
}

async function reconnectStoredRoom(): Promise<void> {
  if (activeRoom) return;

  const reconnectToken = getStoredReconnectToken();
  if (!reconnectToken) return;

  setBusy(true);
  roomReconnecting = true;
  setStatus("Reconnecting...");

  try {
    const nextRoom = await client.reconnect<unknown>(reconnectToken);
    attachRoom(nextRoom as GameRoom);
  } catch {
    roomReconnecting = false;
    clearStoredReconnectToken();
    setBusy(false);
    updateActionButtons();
    setStatus("Reconnect expired.", true);
  }
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
  if (!activeRoom) {
    debugClientInput({
      kind: "send-skip",
      sent: false,
      reason: "no-active-room",
    });
    return;
  }

  if (!myRole) {
    debugClientInput({
      kind: "send-skip",
      sent: false,
      reason: "no-role",
    });
    return;
  }

  if (roomReconnecting) {
    debugClientInput({
      kind: "send-skip",
      sent: false,
      reason: "reconnecting",
    });
    return;
  }

  if (!canSendGameplayInput()) {
    debugClientInput({
      kind: "send-skip",
      sent: false,
      reason: "not-gameplay-phase",
    });
    return;
  }

  const nextInput = inputOverride ?? readCurrentInput();

  if (
    isNeutralDirectionInput(nextInput) &&
    (lastSentInput === null || isNeutralDirectionInput(lastSentInput))
  ) {
    debugClientInput({
      kind: "send-skip",
      sent: false,
      reason: "repeated-neutral",
      input: nextInput,
    });
    return;
  }

  const input = {
    type: "input" as const,
    seq: ++inputSeq,
    clientTime: Date.now(),
    ...nextInput,
  };
  lastSentInput = nextInput;
  activeRoom.send("input", input);

  debugClientInput({
    kind: "send",
    seq: input.seq,
    sent: true,
    input: nextInput,
  });
}

function clearBufferedInput(): void {
  keyboardInput.clear();
  debugClientInput({
    kind: "clear-buffer",
    sent: false,
    reason: "blur-or-hidden",
    input: keyboardInput.peekSnapshot(null),
  });
  sendCurrentInput(keyboardInput.snapshot(null));
}

function readCurrentInput(): DirectionInput {
  return keyboardInput.snapshot(null);
}

function recordServerInputDebug(message: InputDebugMessage): void {
  if (!DEBUG_INPUT) return;

  serverInputDebugEvents.push(message);

  if (serverInputDebugEvents.length > 80) {
    serverInputDebugEvents.shift();
  }

  updateInputDebugOverlay();
}

function updateInputDebugOverlay(): void {
  if (!DEBUG_INPUT) return;

  if (!inputDebugOverlay) {
    inputDebugOverlay = document.createElement("div");
    inputDebugOverlay.className = "input-debug-panel";
    document.body.append(inputDebugOverlay);
  }

  const player = myRole ? latestRoomState.players[myRole] : undefined;
  const lastKey = getLatestClientEvent("keydown") ?? getLatestClientEvent("keyup");
  const lastSend = getLatestClientEvent("send");
  const lastSkip = getLatestClientEvent("send-skip");
  const lastEnqueue = getLatestServerEvent("enqueue");
  const lastConsume = getLatestServerEvent("consume");
  const lastPhysics = getLatestServerEvent("physics-x");
  const lastReject = getLatestServerEvent("reject");
  const physicsEvent = lastPhysics?.event;
  const renderDebug = gameScene.getRenderDebugInfo(myRole);

  inputDebugOverlay.textContent = [
    "INPUT DEBUG",
    `room=${activeRoom?.roomId ?? "-"} role=${myRole ?? "-"} phase=${latestRoomState.phase} level=${latestRoomState.levelId ?? "-"}`,
    `server=${serverUrl} ping=${latestPingMs === null ? "-" : `${latestPingMs}ms`}`,
    `keys ${formatInputBits(latestClientInputSnapshot)}`,
    `player x=${formatNumber(player?.x)} y=${formatNumber(player?.y)} vx=${formatNumber(player?.vx)} seq=${player?.lastProcessedInputSeq ?? "-"}`,
    `camera scroll=${formatNumber(renderDebug.cameraScrollX)},${formatNumber(renderDebug.cameraScrollY)} center=${formatNumber(renderDebug.cameraCenterX)},${formatNumber(renderDebug.cameraCenterY)} follow=${renderDebug.cameraFollowing ? "yes" : "no"}`,
    `render view=${formatNullableNumber(renderDebug.playerViewX)},${formatNullableNumber(renderDebug.playerViewY)} screen=${formatNullableNumber(renderDebug.playerScreenX)},${formatNullableNumber(renderDebug.playerScreenY)}`,
    "",
    `browser ${formatClientDebugEvent(lastKey)}`,
    `client-send ${formatClientDebugEvent(lastSend)}`,
    `client-skip ${formatClientDebugEvent(lastSkip)}`,
    "",
    `server-enqueue ${formatServerDebugEvent(lastEnqueue)}`,
    `server-consume ${formatServerDebugEvent(lastConsume)}`,
    `server-physics axisX=${formatDebugValue(physicsEvent?.axisX)} blocked=${formatDebugValue(physicsEvent?.blocked)} collision=${formatDebugValue(physicsEvent?.collisionId)}`,
    `  prev=${formatDebugValue(physicsEvent?.previousX)} attempt=${formatDebugValue(physicsEvent?.attemptedX)} final=${formatDebugValue(physicsEvent?.finalX)} vx=${formatDebugValue(physicsEvent?.vx)}`,
    `server-reject ${formatServerDebugEvent(lastReject)}`,
  ].join("\n");
}

function getLatestClientEvent(kind: string): ClientInputDebugEvent | undefined {
  for (let index = clientInputDebugEvents.length - 1; index >= 0; index -= 1) {
    if (clientInputDebugEvents[index]?.kind === kind) {
      return clientInputDebugEvents[index];
    }
  }

  return undefined;
}

function getLatestServerEvent(kind: string): InputDebugMessage | undefined {
  for (let index = serverInputDebugEvents.length - 1; index >= 0; index -= 1) {
    if (serverInputDebugEvents[index]?.event.kind === kind) {
      return serverInputDebugEvents[index];
    }
  }

  return undefined;
}

function formatClientDebugEvent(event: ClientInputDebugEvent | undefined): string {
  if (!event) return "-";

  return `${formatAge(event.at)} ${event.kind} code=${event.code ?? "-"} seq=${event.seq ?? "-"} reason=${event.reason ?? "-"} ${formatInputBits(event.input)}`;
}

function formatServerDebugEvent(message: InputDebugMessage | undefined): string {
  if (!message) return "-";

  const event = message.event;

  return `${formatAge(message.at)} ${String(event.kind ?? "-")} role=${formatDebugValue(event.role)} seq=${formatDebugValue(event.seq)} input=${formatInputBits(event.input)}`;
}

function formatInputBits(input: DirectionInput | unknown): string {
  if (!input || typeof input !== "object") return "L0 R0 U0 D0 J0 JP0 I0";

  const record = input as Record<string, unknown>;

  return [
    `L${record.left ? 1 : 0}`,
    `R${record.right ? 1 : 0}`,
    `U${record.up ? 1 : 0}`,
    `D${record.down ? 1 : 0}`,
    `J${record.jump ? 1 : 0}`,
    `JP${record.jumpPressed ? 1 : 0}`,
    `I${record.interactPressed ? 1 : 0}`,
  ].join(" ");
}

function formatAge(at: number): string {
  return `${Math.max(0, Date.now() - at)}ms`;
}

function formatNumber(value: number | undefined): string {
  return value === undefined ? "-" : value.toFixed(1);
}

function formatNullableNumber(value: number | null): string {
  return value === null ? "-" : value.toFixed(1);
}

function formatDebugValue(value: unknown): string {
  if (typeof value === "number") return value.toFixed(2);
  if (value === null) return "null";
  if (value === undefined) return "-";
  return String(value);
}

function handleGameKeyDown(event: KeyboardEvent): void {
  const code = normalizeGameKeyCode(event.code, event.key);

  if (!code) return;

  if (canSendGameplayInput()) {
    event.preventDefault();
    event.stopPropagation();
  }

  const changed = keyboardInput.handleKeyDown(code, event.repeat);

  debugClientInput({
    kind: "keydown",
    code,
    repeat: event.repeat,
    sent: false,
    reason: changed ? "buffer-changed" : "already-held-or-repeat",
    input: keyboardInput.peekSnapshot(null),
  });

  if (changed) {
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

  const changed = keyboardInput.handleKeyUp(code);

  debugClientInput({
    kind: "keyup",
    code,
    sent: false,
    reason: changed ? "buffer-changed" : "was-not-held",
    input: keyboardInput.peekSnapshot(null),
  });

  if (changed) {
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

function sendLevelSelect(): void {
  if (!activeRoom || !canSelectLevel()) {
    syncLevelSelect(latestRoomState.levelIndex);
    return;
  }

  const levelIndex = Number.parseInt(levelSelect.value, 10);

  if (!Number.isSafeInteger(levelIndex) || levelIndex === latestRoomState.levelIndex) {
    return;
  }

  activeRoom.send("select_level", { type: "select_level", levelIndex } satisfies SelectLevelMessage);
  blurActiveControl();
  focusGameControls();
  updateActionButtons();
}

async function leaveActiveRoom(): Promise<void> {
  if (!activeRoom) return;
  stopInputLoop();
  stopPingLoop();
  clearStoredReconnectToken();
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
  levelLabel.textContent = getLevelDisplayName(message.levelIndex, message.levelId);
  syncLevelSelect(message.levelIndex);
  pingLabel.textContent = latestPingMs === null ? "-" : `${latestPingMs}ms`;

  const ownPlayer = myRole ? message.players[myRole] : undefined;

  if (ownPlayer) {
    readySent = ownPlayer.ready;
  } else if (!myRole) {
    readySent = false;
  }

  if (myRole && !message.restartVotes[myRole]) restartRequested = false;

  updateActionButtons();
  updateInputDebugOverlay();

  const connectedCount = getConnectedPlayerCount(message);

  if (Object.keys(message.players).length === 2 && connectedCount < 2) {
    setStatus(`Reconnecting player (${connectedCount}/2)`);
    return;
  }

  if (message.phase === ROOM_PHASES.playing) {
    setStatus(`Playing ${message.levelId ?? "level"} (${connectedCount}/2)`);
    return;
  }

  if (isWarmupState(message)) {
    setStatus(`Warmup ${message.levelId ?? "level"} (1/2)`);
    return;
  }

  if (message.phase === ROOM_PHASES.readyCheck) {
    const readyCount = Object.values(message.players).filter((p) => p?.connected && p.ready).length;
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

  setStatus(`Waiting for players (${connectedCount}/2)`);
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
    !roomReconnecting &&
    Boolean(ownPlayer) &&
    Boolean(ownPlayer?.connected) &&
    !readySent &&
    (latestRoomState.phase === ROOM_PHASES.waiting || latestRoomState.phase === ROOM_PHASES.readyCheck);
  const canRestart =
    Boolean(activeRoom) &&
    !roomReconnecting &&
    Boolean(myRole) &&
    !restartRequested &&
    (latestRoomState.phase === ROOM_PHASES.playing || latestRoomState.phase === ROOM_PHASES.levelComplete);

  readyButton.disabled = !canReady;
  restartButton.disabled = !canRestart;
  levelSelect.disabled = !canSelectLevel();
  readyButton.textContent = readySent ? "READY ✓" : "READY";
  restartButton.textContent = restartRequested ? "RESTART ✓" : "RESTART";
  levelSelect.title = canSelectLevel() ? "Select level" : "Player A can select levels outside loading.";
}

function canSelectLevel(): boolean {
  return (
    Boolean(activeRoom) &&
    !roomReconnecting &&
    myRole === "A" &&
    latestRoomState.phase !== ROOM_PHASES.loadingLevel
  );
}

function syncLevelSelect(levelIndex: number): void {
  const nextValue = String(levelIndex);

  if (levelSelect.value !== nextValue && document.activeElement !== levelSelect) {
    levelSelect.value = nextValue;
  }
}

function canSendGameplayInput(): boolean {
  return !roomReconnecting && (latestRoomState.phase === ROOM_PHASES.playing || isWarmupState(latestRoomState));
}

function isWarmupState(state: RoomStateMessage): boolean {
  return state.phase === ROOM_PHASES.waiting && Boolean(myRole) && getConnectedPlayerCount(state) === 1;
}

function getConnectedPlayerCount(state: RoomStateMessage): number {
  return Object.values(state.players).filter((player) => player?.connected).length;
}

function getLevelDisplayName(levelIndex: number, levelId: string | null): string {
  if (!levelId) return "-";

  const title = latestRoomState.level?.id === levelId ? latestRoomState.level.metadata?.title : null;
  return `${levelIndex + 1}: ${title ?? levelId}`;
}

// ── Utilities ────────────────────────────────────────────────────

function createJoinOptions(): { playerName: string; clientVersion: string } {
  return { playerName: "Player", clientVersion: PROTOCOL_VERSION };
}

function persistRoomReconnectToken(room = activeRoom): void {
  if (!room?.reconnectionToken) return;

  try {
    window.sessionStorage.setItem(reconnectTokenStorageKey, room.reconnectionToken);
  } catch {
    // Session storage can be unavailable in restricted browser contexts.
  }
}

function getStoredReconnectToken(): string | null {
  try {
    return window.sessionStorage.getItem(reconnectTokenStorageKey);
  } catch {
    return null;
  }
}

function clearStoredReconnectToken(): void {
  try {
    window.sessionStorage.removeItem(reconnectTokenStorageKey);
  } catch {
    // Ignore unavailable storage.
  }
}

function setBusy(isBusy: boolean): void {
  createRoomButton.disabled = isBusy;
  roomCodeInput.disabled = isBusy;
  readyButton.disabled = isBusy || readyButton.disabled;
  restartButton.disabled = isBusy || restartButton.disabled;
  levelSelect.disabled = isBusy || levelSelect.disabled;
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

// ── Volume controls ──────────────────────────────────────────────

function setupVolumeControls(): void {
  const toggle = document.getElementById("volume-toggle") as HTMLButtonElement | null;
  const panel = document.getElementById("volume-panel") as HTMLElement | null;
  const muteButton = document.getElementById("volume-mute") as HTMLButtonElement | null;
  const musicSlider = document.getElementById("volume-music") as HTMLInputElement | null;
  const sfxSlider = document.getElementById("volume-sfx") as HTMLInputElement | null;

  if (!toggle || !panel || !muteButton || !musicSlider || !sfxSlider) return;

  const renderState = (): void => {
    const prefs = getAudioPreferences();
    musicSlider.value = String(Math.round(prefs.musicVolume * 100));
    sfxSlider.value = String(Math.round(prefs.sfxVolume * 100));
    muteButton.textContent = prefs.muted ? "UNMUTE" : "MUTE";
    toggle.textContent = prefs.muted ? "🔇" : "🔊";
    toggle.setAttribute("aria-pressed", panel.classList.contains("open") ? "true" : "false");
  };

  toggle.addEventListener("click", () => {
    unlockAudio();
    panel.classList.toggle("open");
    renderState();
  });

  musicSlider.addEventListener("input", () => {
    unlockAudio();
    setMusicVolume(Number.parseInt(musicSlider.value, 10) / 100);
  });

  sfxSlider.addEventListener("input", () => {
    unlockAudio();
    setSfxVolume(Number.parseInt(sfxSlider.value, 10) / 100);
  });

  muteButton.addEventListener("click", () => {
    unlockAudio();
    toggleMuted();
    renderState();
  });

  onAudioPreferencesChange(() => renderState());
  renderState();
}
