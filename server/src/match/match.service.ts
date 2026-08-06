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
import { isBotSession } from "../lobby/lobby.service";

export interface ServerMatch {
  id: string;
  tableId: string;
  seats: { sessionId: string; name: string; seat: Seat; userId?: string }[];
  state: MatchState;
  prevState: MatchState | null;
  target: number;
  buyIn: number;
  pot: number;
  practice: boolean;
  settled: boolean;
}

function cloneState(state: MatchState): MatchState {
  return structuredClone(state);
}

export const DEFAULT_MATCH_TARGET = 501;

@Injectable()
export class MatchService {
  private matches = new Map<string, ServerMatch>();
  private bySession = new Map<string, string>();
  private deadlineProvider: ((matchId: string) => number | null) | null = null;
  private settleHook: ((match: ServerMatch) => void | Promise<void>) | null = null;

  setDeadlineProvider(fn: (matchId: string) => number | null) {
    this.deadlineProvider = fn;
  }

  setSettleHook(fn: (match: ServerMatch) => void | Promise<void>) {
    this.settleHook = fn;
  }

  createFromTable(
    table: LobbyTable,
    opts?: { practice?: boolean; target?: number },
  ): ServerMatch {
    const practice = opts?.practice === true;
    const seats = table.seats
      .map((s, i) =>
        s
          ? {
              sessionId: s.sessionId,
              name: s.name,
              userId: s.userId,
              seat: (i === 0 ? "p0" : "p1") as Seat,
            }
          : null,
      )
      .filter(Boolean) as ServerMatch["seats"];

    let state = createEmptyMatch("p0");
    const prevState = cloneState(state);
    state = startHand(state);

    const buyIn = practice ? 0 : table.buyIn;
    const humanSeats = seats.filter(s => !isBotSession(s.sessionId));
    const pot = practice ? 0 : buyIn * humanSeats.length;

    const match: ServerMatch = {
      id: randomUUID(),
      tableId: table.id,
      seats,
      state,
      prevState,
      target: opts?.target ?? table.target ?? DEFAULT_MATCH_TARGET,
      buyIn,
      pot,
      practice,
      settled: practice || pot === 0,
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

  broadcast(matchId: string, server: Server, opts?: { snap?: boolean }) {
    const match = this.matches.get(matchId);
    if (!match)
      return;

    const snap = opts?.snap === true;
    const winner = this.matchWinner(match);
    const turnDeadlineAt = this.deadlineProvider?.(matchId) ?? null;

    if (winner && !match.settled && this.settleHook)
      void Promise.resolve(this.settleHook(match)).catch(err => console.error("settleHook", err));

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
          buyIn: match.buyIn,
          pot: match.pot,
          practice: match.practice,
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
    return { ok: true as const, justFinished: Boolean(this.matchWinner(match)) };
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
    return { ok: true as const, justFinished: Boolean(this.matchWinner(match)) };
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
