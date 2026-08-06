import { describe, expect, it } from "vitest";
import {
  bid,
  createEmptyMatch,
  deriveAnimEvents,
  playCard,
  startHand,
} from "../index";
import { legalMoves } from "../trick";

describe("deriveAnimEvents", () => {
  it("scripts initial 3-3-3-3 deal → face up → bid UI", () => {
    const waiting = createEmptyMatch("p0");
    const dealt = startHand(waiting, () => 0.42);
    const events = deriveAnimEvents(waiting, dealt, "p0");
    expect(events.map(e => e.type)).toEqual([
      "clear_table",
      // Dealer is p0 → first speaker p1 gets packets 0 and 2; p0 gets 1 and 3
      "opp_deal",
      "deal",
      "opp_deal",
      "deal",
      "face_up_show",
      "bid_ui",
    ]);
    const deals = events.filter(e => e.type === "deal");
    expect(deals).toHaveLength(2);
    for (const d of deals) {
      expect(d.type === "deal" && d.cards).toHaveLength(3);
      expect(d.type === "deal" && d.kind).toBe("initial");
    }
  });

  it("scripts face-up take + rest deal", () => {
    let state = startHand(createEmptyMatch("p0"), () => 0.11);
    const before = structuredClone(state);
    const speaker = state.turn!;
    const taken = bid(state, speaker, { type: "take" });
    expect("error" in taken).toBe(false);
    if ("error" in taken)
      return;
    state = taken;
    const events = deriveAnimEvents(before, state, speaker);
    expect(events.map(e => e.type)).toContain("face_up_hide");
    expect(events.map(e => e.type)).toContain("deal");
    const rest = events.find(e => e.type === "deal");
    expect(rest && rest.type === "deal" && rest.kind).toBe("rest");
    expect(state.hands[speaker]).toHaveLength(9);
  });

  it("scripts play + collect when trick completes in one step", () => {
    let state = startHand(createEmptyMatch("p0"), () => 0.3);
    const first = state.turn!;
    const take = bid(state, first, { type: "take" });
    if ("error" in take)
      throw new Error("take failed");
    state = take;

    const leader = state.turn!;
    const legal1 = legalMoves(state.hands[leader], state.trick, state.trump!);
    const c1 = legal1[0]!;
    const after1 = playCard(state, leader, c1.id);
    if ("error" in after1)
      throw new Error(after1.error);
    state = after1;
    expect(state.trick).toHaveLength(1);

    const beforeSecond = structuredClone(state);
    const second = state.turn!;
    const legal2 = legalMoves(state.hands[second], state.trick, state.trump!);
    const c2 = legal2[0]!;
    const after2 = playCard(state, second, c2.id);
    if ("error" in after2)
      throw new Error(after2.error);
    state = after2;

    const events = deriveAnimEvents(beforeSecond, state, "p0");
    expect(events.map(e => e.type)).toEqual(
      expect.arrayContaining(["play", "trick_collect"]),
    );
    const collect = events.find(e => e.type === "trick_collect");
    expect(collect && collect.type === "trick_collect" && collect.trick).toHaveLength(2);
  });
});
