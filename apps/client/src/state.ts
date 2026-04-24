/**
 * Shared game state type used by both main.ts (networking) and GameScene (rendering).
 */
import type { LevelSchema, RoomStateMessage } from "@coop-game/shared";

export type GameState = RoomStateMessage & {
  level: LevelSchema | null;
};
