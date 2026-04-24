import { describe, expect, it } from "vitest";

import {
  createDirectionTapInput,
  isNeutralDirectionInput,
  KeyboardInputBuffer,
  normalizeGameKeyCode,
} from "./input.js";

describe("KeyboardInputBuffer", () => {
  it("keeps held direction active across snapshots", () => {
    const input = new KeyboardInputBuffer();

    expect(input.handleKeyDown("ArrowRight", false)).toBe(true);
    expect(input.snapshot().right).toBe(true);
    expect(input.snapshot().right).toBe(true);
    expect(input.handleKeyUp("ArrowRight")).toBe(true);
    expect(input.snapshot().right).toBe(false);
  });

  it("does not treat key repeat as an input change", () => {
    const input = new KeyboardInputBuffer();

    expect(input.handleKeyDown("ArrowRight", false, 100)).toBe(true);
    expect(input.handleKeyDown("ArrowRight", true, 120)).toBe(false);
    expect(input.handleKeyDown("ArrowRight", true, 140)).toBe(false);
    expect(input.snapshot().right).toBe(true);
    expect(input.heldDurationMs("ArrowRight", 150)).toBe(50);
  });

  it("consumes pressed actions once while preserving held jump", () => {
    const input = new KeyboardInputBuffer();

    expect(input.handleKeyDown("Space", false)).toBe(true);

    const firstSnapshot = input.snapshot();
    const secondSnapshot = input.snapshot();

    expect(firstSnapshot.jump).toBe(true);
    expect(firstSnapshot.jumpPressed).toBe(true);
    expect(secondSnapshot.jump).toBe(true);
    expect(secondSnapshot.jumpPressed).toBe(false);
  });

  it("clears stale held keys when the window loses focus", () => {
    const input = new KeyboardInputBuffer();

    input.handleKeyDown("ArrowLeft", false);
    input.clear();

    expect(input.snapshot().left).toBe(false);
  });

  it("clears pressed state on keyup to avoid stale action flags", () => {
    const input = new KeyboardInputBuffer();

    // Press jump but release before snapshot (e.g., very quick tap)
    input.handleKeyDown("Space", false);
    input.handleKeyUp("Space");

    // After keyup, jumpPressed should not leak into next snapshot
    const snapshot = input.snapshot();
    expect(snapshot.jump).toBe(false);
    expect(snapshot.jumpPressed).toBe(false);
  });

  it("does not report unheld keyup as a held-state change", () => {
    const input = new KeyboardInputBuffer();

    expect(input.handleKeyUp("ArrowRight")).toBe(false);
    expect(input.snapshot().right).toBe(false);
  });

  it("clears held duration on keyup and clear", () => {
    const input = new KeyboardInputBuffer();

    input.handleKeyDown("ArrowRight", false, 100);
    expect(input.heldDurationMs("ArrowRight", 125)).toBe(25);
    input.handleKeyUp("ArrowRight");
    expect(input.heldDurationMs("ArrowRight", 150)).toBeNull();

    input.handleKeyDown("ArrowLeft", false, 200);
    input.clear();
    expect(input.heldDurationMs("ArrowLeft", 250)).toBeNull();
  });

  it("detects neutral input snapshots", () => {
    const input = new KeyboardInputBuffer();

    expect(isNeutralDirectionInput(input.snapshot())).toBe(true);

    input.handleKeyDown("ArrowRight", false);

    expect(isNeutralDirectionInput(input.snapshot())).toBe(false);
  });

  it("normalizes browser key aliases for game input", () => {
    expect(normalizeGameKeyCode("", "ArrowRight")).toBe("ArrowRight");
    expect(normalizeGameKeyCode("Right", "Right")).toBe("ArrowRight");
    expect(normalizeGameKeyCode("", "d")).toBe("KeyD");
    expect(normalizeGameKeyCode("", " ")).toBe("Space");
    expect(normalizeGameKeyCode("", "Escape")).toBeNull();
  });

  it("creates a one-tick direction tap for missed keydown recovery", () => {
    expect(createDirectionTapInput("ArrowRight")).toMatchObject({
      left: false,
      right: true,
      up: false,
      down: false,
    });
    expect(createDirectionTapInput("KeyA")).toMatchObject({
      left: true,
      right: false,
      up: false,
      down: false,
    });
    expect(createDirectionTapInput("Space")).toBeNull();
  });
});
