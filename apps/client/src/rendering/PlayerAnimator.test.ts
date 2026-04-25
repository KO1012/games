import { describe, expect, it } from "vitest";

import { selectPlayerAnimState } from "./PlayerAnimator.js";

const base = {
  alive: true,
  grounded: true,
  vx: 0,
  vy: 0,
  facing: 1 as 1 | -1,
};

describe("selectPlayerAnimState", () => {
  it("returns death when not alive even if other state would qualify", () => {
    expect(selectPlayerAnimState({ ...base, alive: false, vx: 200, vy: -300, grounded: false })).toEqual({
      state: "death",
      facing: 1,
    });
  });

  it("returns jump when airborne with upward velocity", () => {
    expect(selectPlayerAnimState({ ...base, grounded: false, vy: -200 })).toEqual({
      state: "jump",
      facing: 1,
    });
  });

  it("returns fall when airborne with non-negative vy", () => {
    expect(selectPlayerAnimState({ ...base, grounded: false, vy: 0 })).toEqual({
      state: "fall",
      facing: 1,
    });
    expect(selectPlayerAnimState({ ...base, grounded: false, vy: 250 })).toEqual({
      state: "fall",
      facing: 1,
    });
  });

  it("returns run when grounded and horizontal speed exceeds threshold", () => {
    expect(selectPlayerAnimState({ ...base, vx: 50 })).toEqual({ state: "run", facing: 1 });
    expect(selectPlayerAnimState({ ...base, vx: -50, facing: -1 })).toEqual({
      state: "run",
      facing: -1,
    });
  });

  it("returns idle when grounded and below threshold", () => {
    expect(selectPlayerAnimState({ ...base, vx: 5 })).toEqual({ state: "idle", facing: 1 });
    expect(selectPlayerAnimState({ ...base, vx: 0 })).toEqual({ state: "idle", facing: 1 });
  });

  it("normalizes facing to right when undefined-ish input", () => {
    expect(selectPlayerAnimState({ ...base, facing: 1, vx: 0 })).toEqual({
      state: "idle",
      facing: 1,
    });
  });
});
