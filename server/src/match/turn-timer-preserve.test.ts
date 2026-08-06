import { describe, expect, it } from "vitest";

/**
 * Pure helper mirroring TurnTimerService preserve logic — keeps reconnect
 * from extending a human's clock (cash-game stall abuse).
 *
 * Returns:
 * - existing deadline when preserve + still valid
 * - `null` when preserve + expired (service fires immediately)
 * - fresh now+timeout otherwise
 */
export function nextDeadlineMs(
  existing: number | null,
  now: number,
  preserve: boolean,
  turnTimeoutMs: number,
): number | null {
  if (preserve) {
    if (existing != null && existing > now + 200)
      return existing;
    if (existing != null)
      return null; // expired → fire now
  }
  return now + turnTimeoutMs;
}

describe("turn timer preserveDeadline", () => {
  it("keeps remaining deadline on reconnect", () => {
    const now = 1_000_000;
    const existing = now + 12_000;
    expect(nextDeadlineMs(existing, now, true, 20_000)).toBe(existing);
  });

  it("starts a fresh clock after a real turn change", () => {
    const now = 1_000_000;
    expect(nextDeadlineMs(now + 5_000, now, false, 20_000)).toBe(now + 20_000);
  });

  it("signals immediate fire when preserved deadline already expired", () => {
    const now = 1_000_000;
    expect(nextDeadlineMs(now - 1, now, true, 20_000)).toBeNull();
  });
});
