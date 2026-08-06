/**
 * Framework-free sliding-window rate limiter (no Nest/socket.io imports),
 * so it's directly unit-testable. Used to cap `match:emote` spam per
 * session without needing a database or external store.
 */
export class SlidingWindowLimiter {
  private history = new Map<string, number[]>();

  constructor(
    private readonly maxEvents: number,
    private readonly windowMs: number,
  ) {}

  /** Returns true and records the event if under the limit, else false. */
  tryConsume(key: string, now: number = Date.now()): boolean {
    const recent = (this.history.get(key) ?? []).filter(
      ts => now - ts < this.windowMs,
    );
    if (recent.length >= this.maxEvents) {
      this.history.set(key, recent);
      return false;
    }
    recent.push(now);
    this.history.set(key, recent);
    return true;
  }

  reset(key: string) {
    this.history.delete(key);
  }
}
