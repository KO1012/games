/**
 * Backwards-compatible facade.
 *
 * Implementation lives in SfxManager.ts (which adds external OGG support
 * and user-controlled volume). Existing call sites that import this module
 * via `import * as Sound from "../audio/SoundManager.js"` keep working.
 */
export {
  bindSfxScene,
  playButtonPress,
  playButtonRelease,
  playDeath,
  playDoorClose,
  playDoorOpen,
  playGameComplete,
  playInteract,
  playJump,
  playLand,
  playLaserHum,
  playLevelComplete,
  playLevelStart,
  playRespawn,
  unlockAudio,
} from "./SfxManager.js";
