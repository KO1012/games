export const PROTOCOL_VERSION = "0.1.0";
export const ROOM_NAME = "coop_room";
export const ROOM_CODE_LENGTH = 4;

export const DEFAULT_CLIENT_WIDTH = 1280;
export const DEFAULT_CLIENT_HEIGHT = 720;
export const DEFAULT_SERVER_PORT = 2567;

export const PLAYER_SIZE = 48;
export const PLAYER_SPEED = 260;
export const PLAYER_JUMP_SPEED = 760;
export const PLAYER_MAX_FALL_SPEED = 980;
export const PLAYER_RESPAWN_MS = 900;

export const PLAYER_SPAWNS = {
  A: {
    x: 180,
    y: 336,
  },
  B: {
    x: 260,
    y: 336,
  },
} as const;

export const SERVER_TICK_HZ = 60;
export const INPUT_SEND_HZ = 20;
export const STATE_PATCH_HZ = 20;
