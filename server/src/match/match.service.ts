import type { Server } from "socket.io";
import type { BidAction, MatchAnimEvent, MatchState, Seat } from "../../../shared/game";
import type { LobbyTable } from "../lobby/lobby.service";
import { randomUUID } from "node:crypto";
import { Injectable } from "@nestjs/common";
import {
  bid,
  createEmptyMatch,
  deriveAnimEvents,
  perspective,
  playCard,
  startHand,
} from "../../../shared/game";

export interface ServerMatch {
  id: string;
  tableId: string;
  seats: { sessionId: string; name: string; seat: Seat }[];
  state: MatchState;
  prevState: MatchState | null;
  target: number;
}

function cloneState(state: MatchState): MatchState {
  return structuredClone(state);
}

export const DEFAULT_MATCH_TARGET = 501;

@Injectable()
export class MatchService {
  private matches = new Map<string, ServerMatch>();
  private bySession = new Map<string, string>();
  /**
   * Wired up in providers.ts to `TurnTimerService.deadlineFor` after both
   * singletons exist — avoids a circular constructor dependency (the timer
   * service needs `MatchService` to act on timeout) while still letting
   * `broadcast` attach the live deadline to every `match:state` payload.
   */
  private deadlineProvider: ((matchId: string) => number | null) | null = null;

  setDeadlineProvider(fn: (matchId: string) => number | null) {
    this.deadlineProvider = fn;
  }

  createFromTable(table: LobbyTable, target = DEFAULT_MATCH_TARGET): ServerMatch {
    const seats = table.seats
      .map((s, i) =>
        s
          ? {
              sessionId: s.sessionId,
              name: s.name,
              seat: (i === 0 ? "p0" : "p1") as Seat,
            }
          : null,
      )
      .filter(Boolean) as ServerMatch["seats"];

    let state = createEmptyMatch("p0");
    const prevState = cloneState(state);
    state = startHand(state);

    const match: ServerMatch = {
      id: randomUUID(),
      tableId: table.id,
      seats,
      state,
      prevState,
      target,
    };
    this.matches.set(match.id, match);
    for (const s of seats) this.bySession.set(s.sessionId, match.id);
    return match;
  }

  get(id: string) {
    return this.matches.get(id);
  }

  getBySession(sessionId: string) {
    const id = this.bySession.get(sessionId);
    return id ? this.matches.get(id) : undefined;
  }

  seatOf(match: ServerMatch, sessionId: string): Seat | undefined {
    return match.seats.find(s => s.sessionId === sessionId)?.seat;
  }

  endMatch(matchId: string) {
    const match = this.matches.get(matchId);
    if (!match)
      return;
    for (const s of match.seats) this.bySession.delete(s.sessionId);
    this.matches.delete(matchId);
  }

  /** Broadcast view + anim; pass `{ snap: true }` on join/reconnect. */
  broadcast(matchId: string, server: Server, opts?: { snap?: boolean }) {
    const match = this.matches.get(matchId);
    if (!match)
      return;

    const snap = opts?.snap === true;
    const winner = this.matchWinner(match);
    const turnDeadlineAt = this.deadlineProvider?.(matchId) ?? null;

    for (const s of match.seats) {
      const view = perspective(match.state, s.seat);
      const anim: MatchAnimEvent[] = snap
        ? []
        : deriveAnimEvents(match.prevState, match.state, s.seat);

      server.to(`session:${s.sessionId}`).emit("match:state", {
        matchId,
        players: match.seats.map(x => ({
          seat: x.seat,
          name: x.name,
        })),
        view: {
          ...view,
          target: match.target,
          matchOver: winner
            ? { winner: winner.seat, reason: winner.reason }
            : null,
          turnDeadlineAt,
        },
        anim,
        snap,
      });
    }

    match.prevState = cloneState(match.state);
  }

  matchWinner(match: ServerMatch): { seat: Seat; reason: "points" | "bolts" } | null {
    const { p0, p1, bolts } = match.state.matchScore;
    if (bolts.p0 >= 3)
      return { seat: "p0", reason: "bolts" };
    if (bolts.p1 >= 3)
      return { seat: "p1", reason: "bolts" };
    if (p0 >= match.target && p0 > p1)
      return { seat: "p0", reason: "points" };
    if (p1 >= match.target && p1 > p0)
      return { seat: "p1", reason: "points" };
    return null;
  }

  notifyOpponentLeft(matchId: string, leaverSessionId: string, server: Server) {
    const match = this.matches.get(matchId);
    if (!match)
      return;
    for (const s of match.seats) {
      if (s.sessionId === leaverSessionId)
        continue;
      server.to(`session:${s.sessionId}`).emit("match:ended", {
        matchId,
        reason: "opponent_left",
      });
    }
    this.endMatch(matchId);
  }

  doBid(matchId: string, sessionId: string, action: BidAction) {
    const match = this.matches.get(matchId);
    if (!match)
      return { error: "no_match" };
    if (this.matchWinner(match))
      return { error: "match_over" };
    const seat = this.seatOf(match, sessionId);
    if (!seat)
      return { error: "not_seated" };
    const result = bid(match.state, seat, action);
    if ("error" in result)
      return result;
    match.state = result;
    return { ok: true as const };
  }

  doPlay(matchId: string, sessionId: string, cardId: string) {
    const match = this.matches.get(matchId);
    if (!match)
      return { error: "no_match" };
    if (this.matchWinner(match))
      return { error: "match_over" };
    const seat = this.seatOf(match, sessionId);
    if (!seat)
      return { error: "not_seated" };
    const result = playCard(match.state, seat, cardId);
    if ("error" in result)
      return result;
    match.state = result;
    return { ok: true as const };
  }

  nextHand(matchId: string, sessionId: string) {
    const match = this.matches.get(matchId);
    if (!match)
      return { error: "no_match" };
    if (!this.seatOf(match, sessionId))
      return { error: "not_seated" };
    if (this.matchWinner(match))
      return { error: "match_over" };
    if (match.state.phase !== "handEnd")
      return { error: "wrong_phase" };
    match.state = startHand(match.state);
    return { ok: true as const };
  }
}
