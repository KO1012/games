import type { InputMessage } from "@coop-game/shared";

export type DirectionInput = Pick<
  InputMessage,
  "left" | "right" | "up" | "down" | "jump" | "jumpPressed" | "interactPressed"
>;

export const gameKeyCodes = new Set([
  "ArrowLeft",
  "ArrowRight",
  "ArrowUp",
  "ArrowDown",
  "KeyA",
  "KeyD",
  "KeyW",
  "KeyS",
  "Space",
  "KeyE",
]);

export function normalizeGameKeyCode(code: string, key: string): string | null {
  if (gameKeyCodes.has(code)) {
    return code;
  }

  switch (key) {
    case "ArrowLeft":
    case "Left":
      return "ArrowLeft";
    case "ArrowRight":
    case "Right":
      return "ArrowRight";
    case "ArrowUp":
    case "Up":
      return "ArrowUp";
    case "ArrowDown":
    case "Down":
      return "ArrowDown";
    case " ":
    case "Space":
    case "Spacebar":
      return "Space";
    default:
      break;
  }

  const upperKey = key.toUpperCase();

  if (upperKey === "A") return "KeyA";
  if (upperKey === "D") return "KeyD";
  if (upperKey === "W") return "KeyW";
  if (upperKey === "S") return "KeyS";
  if (upperKey === "E") return "KeyE";

  return null;
}

export class KeyboardInputBuffer {
  private readonly heldKeys = new Set<string>();
  private readonly heldKeyStartedAt = new Map<string, number>();
  private readonly pressedKeys = new Set<string>();

  public handleKeyDown(code: string, repeat: boolean, now = Date.now()): boolean {
    if (!gameKeyCodes.has(code)) {
      return false;
    }

    const wasHeld = this.heldKeys.has(code);
    this.heldKeys.add(code);

    if (!wasHeld) {
      this.heldKeyStartedAt.set(code, now);
    }

    if (!repeat && isPressedKey(code)) {
      this.pressedKeys.add(code);
    }

    return !wasHeld;
  }

  public handleKeyUp(code: string): boolean {
    if (!gameKeyCodes.has(code)) {
      return false;
    }

    const wasHeld = this.heldKeys.delete(code);
    this.heldKeyStartedAt.delete(code);
    const wasPressed = this.pressedKeys.delete(code);
    return wasHeld || wasPressed;
  }

  public clear(): void {
    this.heldKeys.clear();
    this.heldKeyStartedAt.clear();
    this.pressedKeys.clear();
  }

  public heldDurationMs(code: string, now = Date.now()): number | null {
    const startedAt = this.heldKeyStartedAt.get(code);

    if (startedAt === undefined) {
      return null;
    }

    return Math.max(0, now - startedAt);
  }

  public snapshot(sceneInput: DirectionInput | null = null): DirectionInput {
    const bufferedInput: DirectionInput = {
      left: this.heldKeys.has("KeyA") || this.heldKeys.has("ArrowLeft"),
      right: this.heldKeys.has("KeyD") || this.heldKeys.has("ArrowRight"),
      up: this.heldKeys.has("KeyW") || this.heldKeys.has("ArrowUp"),
      down: this.heldKeys.has("KeyS") || this.heldKeys.has("ArrowDown"),
      jump: this.heldKeys.has("Space"),
      jumpPressed: this.consumePressedKey("Space"),
      interactPressed: this.consumePressedKey("KeyE"),
    };

    if (!sceneInput) {
      return bufferedInput;
    }

    return {
      left: sceneInput.left || bufferedInput.left,
      right: sceneInput.right || bufferedInput.right,
      up: sceneInput.up || bufferedInput.up,
      down: sceneInput.down || bufferedInput.down,
      jump: sceneInput.jump || bufferedInput.jump,
      jumpPressed: sceneInput.jumpPressed || bufferedInput.jumpPressed,
      interactPressed: sceneInput.interactPressed || bufferedInput.interactPressed,
    };
  }

  private consumePressedKey(code: string): boolean {
    const wasPressed = this.pressedKeys.has(code);
    this.pressedKeys.delete(code);
    return wasPressed;
  }
}

export function isNeutralDirectionInput(input: DirectionInput): boolean {
  return (
    !input.left &&
    !input.right &&
    !input.up &&
    !input.down &&
    !input.jump &&
    !input.jumpPressed &&
    !input.interactPressed
  );
}

function isPressedKey(code: string): boolean {
  return code === "Space" || code === "KeyE";
}
