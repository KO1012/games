import type {
  ButtonStateSnapshot,
  DoorStateSnapshot,
  LevelSchema,
  MovingPlatformStateSnapshot,
  TrapStateSnapshot,
} from "./level.js";

export const ROOM_PHASES = {
  created: "created",
  waiting: "waiting",
  readyCheck: "readyCheck",
  loadingLevel: "loadingLevel",
  playing: "playing",
  levelComplete: "levelComplete",
  finished: "finished",
} as const;

export type RoomPhase = (typeof ROOM_PHASES)[keyof typeof ROOM_PHASES];

export const PLAYER_ROLES = {
  A: "A",
  B: "B",
} as const;

export type PlayerRole = (typeof PLAYER_ROLES)[keyof typeof PLAYER_ROLES];

export type ClientReadyMessage = {
  type: "client_ready";
  ready: boolean;
};

export type InputMessage = {
  type: "input";
  seq: number;
  clientTime: number;
  left: boolean;
  right: boolean;
  up: boolean;
  jump: boolean;
  jumpPressed: boolean;
  down: boolean;
  interactPressed: boolean;
};

export type RestartVoteMessage = {
  type: "restart_vote";
  approve: boolean;
};

export type PingMessage = {
  type: "ping";
  clientTime: number;
};

export type ClientMessage = ClientReadyMessage | InputMessage | RestartVoteMessage | PingMessage;

export type PlayerState = {
  sessionId: string;
  playerIndex: 0 | 1;
  role: PlayerRole;
  name: string;
  connected: boolean;
  ready: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  facing: -1 | 1;
  grounded: boolean;
  alive: boolean;
  respawnAt: number;
  lastProcessedInputSeq: number;
};

export type PlayerSnapshot = Pick<
  PlayerState,
  | "sessionId"
  | "playerIndex"
  | "role"
  | "name"
  | "connected"
  | "ready"
  | "x"
  | "y"
  | "vx"
  | "vy"
  | "facing"
  | "grounded"
  | "alive"
  | "respawnAt"
  | "lastProcessedInputSeq"
>;

export type RoomJoinedMessage = {
  roomCode: string;
  role: PlayerRole;
  playerIndex: 0 | 1;
};

export type RoomStateMessage = {
  phase: RoomPhase;
  roomCode: string;
  levelId: string | null;
  levelIndex: number;
  level: LevelSchema | null;
  serverTime: number;
  players: Partial<Record<PlayerRole, PlayerSnapshot>>;
  buttons: Record<string, ButtonStateSnapshot>;
  doors: Record<string, DoorStateSnapshot>;
  traps: Record<string, TrapStateSnapshot>;
  movingPlatforms: Record<string, MovingPlatformStateSnapshot>;
  restartVotes: Partial<Record<PlayerRole, boolean>>;
};

export type RoomErrorMessage = {
  code: string;
  message: string;
};

export type LevelStartMessage = {
  type: "level_start";
  levelId: string;
  levelIndex: number;
  level: LevelSchema;
  serverTime: number;
};

export type LevelCompleteMessage = {
  type: "level_complete";
  levelId: string;
  nextLevelId: string | null;
  completeTimeMs: number;
};

export type PongMessage = {
  type: "pong";
  clientTime: number;
  serverTime: number;
};

export type ServerMessageMap = {
  room_joined: RoomJoinedMessage;
  room_state: RoomStateMessage;
  level_start: LevelStartMessage;
  level_complete: LevelCompleteMessage;
  pong: PongMessage;
  room_error: RoomErrorMessage;
};
