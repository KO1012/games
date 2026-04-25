import { describe, expect, it } from "vitest";
import type { InputMessage } from "@coop-game/shared";

import { CoopRoom } from "./CoopRoom.js";

type TestPlayer = {
  inputQueue: InputMessage[];
  lastInput: InputMessage | null;
  lastInputAt: number;
  interactQueued: boolean;
  jumpQueued: boolean;
  directionPulseTicks: {
    left: number;
    right: number;
    up: number;
    down: number;
  };
  horizontalIntent: -1 | 0 | 1;
  verticalIntent: -1 | 0 | 1;
};

function makeInput(seq: number, patch: Partial<InputMessage> = {}): InputMessage {
  return {
    type: "input",
    seq,
    clientTime: seq,
    left: false,
    right: false,
    up: false,
    down: false,
    jump: false,
    jumpPressed: false,
    interactPressed: false,
    ...patch,
  };
}

function makePlayer(overrides: Partial<TestPlayer> = {}): TestPlayer {
  return {
    inputQueue: [],
    lastInput: null,
    lastInputAt: 0,
    interactQueued: false,
    jumpQueued: false,
    directionPulseTicks: {
      left: 0,
      right: 0,
      up: 0,
      down: 0,
    },
    horizontalIntent: 0,
    verticalIntent: 0,
    ...overrides,
  };
}

function consume(player: TestPlayer): InputMessage {
  const room = new CoopRoom() as unknown as {
    consumePlayerInputsForTick: (player: TestPlayer) => InputMessage;
  };
  return room.consumePlayerInputsForTick(player) as InputMessage;
}

function expectNoOppositeDirections(input: InputMessage): void {
  expect(input.left && input.right).toBe(false);
  expect(input.up && input.down).toBe(false);
}

describe("CoopRoom direction input conflict resolution", () => {
  it("keeps the latest horizontal direction when opposite directions happen in one tick", () => {
    const player = makePlayer({
      inputQueue: [makeInput(1, { left: true }), makeInput(2), makeInput(3, { right: true }), makeInput(4)],
    });

    const output = consume(player);

    expectNoOppositeDirections(output);
    expect(output.left).toBe(false);
    expect(output.right).toBe(true);
    expect(Number(output.right) - Number(output.left)).toBe(1);
  });

  it("keeps latest intent across an empty tick when both keys are still held", () => {
    const player = makePlayer({
      lastInput: makeInput(10, { left: true }),
      horizontalIntent: -1,
      inputQueue: [makeInput(11, { left: true, right: true })],
    });

    const firstOutput = consume(player);

    expectNoOppositeDirections(firstOutput);
    expect(firstOutput.left).toBe(false);
    expect(firstOutput.right).toBe(true);
    expect(player.horizontalIntent).toBe(1);

    const secondOutput = consume(player);

    expectNoOppositeDirections(secondOutput);
    expect(secondOutput.left).toBe(false);
    expect(secondOutput.right).toBe(true);
  });

  it("restores the opposite held direction when the latest direction is released", () => {
    const player = makePlayer({
      lastInput: makeInput(10, { left: true, right: true }),
      horizontalIntent: 1,
      directionPulseTicks: {
        left: 0,
        right: 3,
        up: 0,
        down: 0,
      },
      inputQueue: [makeInput(11, { left: true, right: false })],
    });

    const output = consume(player);

    expectNoOppositeDirections(output);
    expect(output.left).toBe(true);
    expect(output.right).toBe(false);
    expect(player.horizontalIntent).toBe(-1);
    expect(player.directionPulseTicks.right).toBe(0);
  });

  it("keeps a short same-tick tap visible through direction pulses", () => {
    const player = makePlayer({
      inputQueue: [makeInput(1, { right: true }), makeInput(2, { right: false })],
    });

    const output = consume(player);

    expectNoOppositeDirections(output);
    expect(output.left).toBe(false);
    expect(output.right).toBe(true);
    expect(Number(output.right) - Number(output.left)).toBe(1);
  });

  it("uses a late old press only as a pulse without replacing the released held snapshot", () => {
    const player = makePlayer({
      lastInput: makeInput(2, { right: false }),
      inputQueue: [makeInput(1, { right: true })],
    });

    const firstOutput = consume(player);

    expectNoOppositeDirections(firstOutput);
    expect(firstOutput.right).toBe(true);
    expect(player.lastInput).toMatchObject({ seq: 2, right: false });

    consume(player);
    consume(player);
    consume(player);
    const afterPulse = consume(player);

    expectNoOppositeDirections(afterPulse);
    expect(afterPulse.right).toBe(false);
  });

  it("does not let a stale opposite pulse override the current held intent", () => {
    const player = makePlayer({
      lastInput: makeInput(10, { right: true }),
      horizontalIntent: 1,
      inputQueue: [makeInput(9, { left: true })],
    });

    const output = consume(player);

    expectNoOppositeDirections(output);
    expect(output.left).toBe(false);
    expect(output.right).toBe(true);
    expect(player.horizontalIntent).toBe(1);
    expect(player.lastInput).toMatchObject({ seq: 10, right: true });
  });

  it("keeps the latest vertical direction when opposite vertical directions happen in one tick", () => {
    const player = makePlayer({
      inputQueue: [makeInput(1, { up: true }), makeInput(2), makeInput(3, { down: true }), makeInput(4)],
    });

    const output = consume(player);

    expectNoOppositeDirections(output);
    expect(output.up).toBe(false);
    expect(output.down).toBe(true);
    expect(Number(output.down) - Number(output.up)).toBe(1);
  });

  it("never returns both left and right as true even with overlapping snapshots", () => {
    const player = makePlayer({
      inputQueue: [makeInput(1, { left: true }), makeInput(2, { left: true, right: true })],
    });

    const output = consume(player);

    expectNoOppositeDirections(output);
  });
});
