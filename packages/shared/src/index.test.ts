import { describe, expect, it } from "vitest";

import {
  DEFAULT_SERVER_PORT,
  INPUT_SEND_HZ,
  PLAYER_JUMP_SPEED,
  PLAYER_MAX_FALL_SPEED,
  PLAYER_SPEED,
  PROTOCOL_VERSION,
  ROOM_CODE_LENGTH,
  ROOM_NAME,
  SERVER_TICK_HZ,
  STATE_PATCH_HZ,
} from "./index.js";

describe("shared constants", () => {
  it("matches the documented protocol baseline", () => {
    expect(PROTOCOL_VERSION).toBe("0.1.0");
    expect(ROOM_NAME).toBe("coop_room");
    expect(ROOM_CODE_LENGTH).toBe(4);
    expect(DEFAULT_SERVER_PORT).toBe(2567);
    expect(PLAYER_SPEED).toBe(260);
    expect(PLAYER_JUMP_SPEED).toBe(760);
    expect(PLAYER_MAX_FALL_SPEED).toBe(980);
    expect(SERVER_TICK_HZ).toBe(60);
    expect(INPUT_SEND_HZ).toBe(60);
    expect(STATE_PATCH_HZ).toBe(60);
  });
});
