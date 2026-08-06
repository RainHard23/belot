import { describe, expect, it } from "vitest";
import { SlidingWindowLimiter } from "./rate-limiter";

describe("slidingWindowLimiter", () => {
  it("allows events up to the max within the window", () => {
    const limiter = new SlidingWindowLimiter(3, 1000);
    expect(limiter.tryConsume("a", 0)).toBe(true);
    expect(limiter.tryConsume("a", 10)).toBe(true);
    expect(limiter.tryConsume("a", 20)).toBe(true);
  });

  it("blocks the event that exceeds the max", () => {
    const limiter = new SlidingWindowLimiter(3, 1000);
    limiter.tryConsume("a", 0);
    limiter.tryConsume("a", 10);
    limiter.tryConsume("a", 20);
    expect(limiter.tryConsume("a", 30)).toBe(false);
  });

  it("allows again once old events fall outside the window", () => {
    const limiter = new SlidingWindowLimiter(2, 1000);
    limiter.tryConsume("a", 0);
    limiter.tryConsume("a", 100);
    expect(limiter.tryConsume("a", 500)).toBe(false);
    expect(limiter.tryConsume("a", 1600)).toBe(true); // t=0 event is now stale
  });

  it("tracks separate keys independently", () => {
    const limiter = new SlidingWindowLimiter(1, 1000);
    expect(limiter.tryConsume("a", 0)).toBe(true);
    expect(limiter.tryConsume("b", 0)).toBe(true);
    expect(limiter.tryConsume("a", 1)).toBe(false);
  });

  it("reset clears history for a key", () => {
    const limiter = new SlidingWindowLimiter(1, 1000);
    limiter.tryConsume("a", 0);
    expect(limiter.tryConsume("a", 1)).toBe(false);
    limiter.reset("a");
    expect(limiter.tryConsume("a", 2)).toBe(true);
  });
});
