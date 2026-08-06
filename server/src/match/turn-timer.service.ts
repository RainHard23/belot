import type { Server } from "socket.io";
import type { Seat } from "../../../shared/game";
import type { MatchService, ServerMatch } from "./match.service";
import { Injectable } from "@nestjs/common";
import { isBotSession } from "../lobby/lobby.service";
import { decideTimeout } from "./turn-timer-logic";

/** How long a human gets to act before the server acts for them. */
export const TURN_TIMEOUT_MS = 20_000;
/** Auto-advance handEnd so cash games cannot stall forever. */
export const HAND_END_TIMEOUT_MS = 12_000;

/**
 * Enforces the turn clock server-side. Mirrors `BotService`'s
 * schedule/cancel-per-matchId pattern so both timers can coexist without
 * fighting over the same match: this one only ever fires for a *human*
 * seat, and always cancels itself first (see `schedule`), so re-scheduling
 * after every state change is safe and idempotent.
 *
 * Reconnect/join uses `{ preserveDeadline: true }` so a refresh cannot
 * reset the clock (stall abuse).
 */
@Injectable()
export class TurnTimerService {
  private timers = new Map<string, ReturnType<typeof setTimeout>>();
  private deadlines = new Map<string, number>();
  /**
   * Wired up in providers.ts to `BotService.poke` after both singletons
   * exist (same pattern as `MatchService.setDeadlineProvider`) — a timeout
   * can hand the turn straight to the bot, and nothing else would ever
   * wake it up otherwise.
   */
  private botPoke: ((matchId: string, server: Server) => void) | null = null;

  constructor(private readonly matches: MatchService) {}

  setBotPoke(fn: (matchId: string, server: Server) => void) {
    this.botPoke = fn;
  }

  /** Deadline (epoch ms) for the current turn, or null if none is running. */
  deadlineFor(matchId: string): number | null {
    return this.deadlines.get(matchId) ?? null;
  }

  /**
   * Restore a persisted deadline after process boot (ms remaining / absolute).
   * Used when hydrating matches from Postgres.
   */
  restoreDeadline(matchId: string, deadlineAt: number, server: Server) {
    this.cancel(matchId);
    const remaining = deadlineAt - Date.now();
    if (remaining <= 200) {
      // Persisted clock already expired — act now, don't mint a fresh 20s.
      this.timers.set(
        matchId,
        setTimeout(() => this.fire(matchId, server), 0),
      );
      return;
    }
    this.deadlines.set(matchId, deadlineAt);
    this.timers.set(
      matchId,
      setTimeout(() => this.fire(matchId, server), remaining),
    );
  }

  /**
   * Call after every state-changing action (default: fresh 20s), or on
   * reconnect with `{ preserveDeadline: true }` to keep the remaining clock.
   */
  schedule(matchId: string, server: Server, opts?: { preserveDeadline?: boolean }) {
    const match = this.matches.get(matchId);
    if (!match || this.matches.matchWinner(match)) {
      this.cancel(matchId);
      return;
    }

    const { phase, turn } = match.state;
    const actingSeat = match.seats.find(s => s.seat === turn);

    if (phase === "handEnd") {
      this.cancel(matchId);
      const deadline = Date.now() + HAND_END_TIMEOUT_MS;
      this.deadlines.set(matchId, deadline);
      this.timers.set(
        matchId,
        setTimeout(() => this.fireHandEnd(matchId, server), HAND_END_TIMEOUT_MS),
      );
      return;
    }

    if (!actingSeat || isBotSession(actingSeat.sessionId)) {
      this.cancel(matchId);
      return; // bot's own delay (BotService) governs this turn instead
    }
    if (phase !== "bidding1" && phase !== "bidding2" && phase !== "playing") {
      this.cancel(matchId);
      return;
    }

    if (opts?.preserveDeadline) {
      const existing = this.deadlines.get(matchId);
      if (existing && existing > Date.now() + 200) {
        // Re-arm the same deadline — do not extend (F5 / match:join abuse).
        const prev = this.timers.get(matchId);
        if (prev)
          clearTimeout(prev);
        const remaining = existing - Date.now();
        this.timers.set(
          matchId,
          setTimeout(() => this.fire(matchId, server), remaining),
        );
        return;
      }
      if (existing) {
        // Deadline already expired while client was gone — act now, don't mint 20s.
        this.cancel(matchId);
        this.fire(matchId, server);
        return;
      }
    }

    this.cancel(matchId);
    const deadline = Date.now() + TURN_TIMEOUT_MS;
    this.deadlines.set(matchId, deadline);
    this.timers.set(
      matchId,
      setTimeout(() => this.fire(matchId, server), TURN_TIMEOUT_MS),
    );
  }

  cancel(matchId: string) {
    const timer = this.timers.get(matchId);
    if (timer)
      clearTimeout(timer);
    this.timers.delete(matchId);
    this.deadlines.delete(matchId);
  }

  private fire(matchId: string, server: Server) {
    this.timers.delete(matchId);
    this.deadlines.delete(matchId);

    const match = this.matches.get(matchId);
    if (!match || this.matches.matchWinner(match))
      return;

    const seat = match.state.turn;
    if (!seat)
      return;
    const entry = match.seats.find(s => s.seat === seat);
    if (!entry)
      return;

    const result = this.act(match, entry.sessionId, seat);
    if (!result)
      return;

    // Schedule *before* broadcasting so the payload carries the fresh
    // deadline (or none, if it's now the bot's turn) instead of whatever
    // was left over from the turn that just timed out.
    this.schedule(matchId, server);
    this.matches.broadcast(matchId, server);
    // A timeout can hand the turn straight to the bot — nothing else would
    // ever wake it up otherwise.
    this.botPoke?.(matchId, server);
  }

  private fireHandEnd(matchId: string, server: Server) {
    this.timers.delete(matchId);
    this.deadlines.delete(matchId);
    const result = this.matches.forceNextHand(matchId);
    if ("error" in result)
      return;
    this.schedule(matchId, server);
    this.matches.broadcast(matchId, server);
    this.botPoke?.(matchId, server);
  }

  /** Delegates the actual decision to the pure, unit-tested `decideTimeout`. */
  private act(match: ServerMatch, sessionId: string, seat: Seat): boolean {
    const decision = decideTimeout(match.state, seat);
    if (decision.kind === "bid") {
      const result = this.matches.doBid(match.id, sessionId, decision.action);
      return "ok" in result;
    }
    if (decision.kind === "play") {
      const result = this.matches.doPlay(match.id, sessionId, decision.cardId);
      return "ok" in result;
    }
    return false;
  }
}
