import type { Server } from "socket.io";
import type { BidAction, Seat } from "../../../shared/game";
import type { EmotePayload } from "../../../shared/net/protocol";
import type { MatchService } from "./match.service";
import type { TurnTimerService } from "./turn-timer.service";
import { Injectable } from "@nestjs/common";
import { legalMoves, SUITS } from "../../../shared/game";
import { EMOTE_KINDS } from "../../../shared/net/protocol";
import { isBotSession } from "../lobby/lobby.service";

const MIN_DELAY_MS = 550;
const MAX_DELAY_MS = 1400;
/** Keep the solo practice table from feeling dead without spamming reactions. */
const BOT_EMOTE_CHANCE = 0.12;

/**
 * Drives the practice-table bot seat: after any state change that might hand
 * the turn to a bot, `poke()` schedules a legal bid/play a beat later so it
 * feels like a real (if simple) opponent rather than an instant robot.
 */
@Injectable()
export class BotService {
  private timers = new Map<string, ReturnType<typeof setTimeout>>();

  constructor(
    private readonly matches: MatchService,
    private readonly turnTimer: TurnTimerService,
  ) {}

  /** Call after every state-changing action, harmless if no bot is seated. */
  poke(matchId: string, server: Server) {
    const match = this.matches.get(matchId);
    if (!match)
      return;
    const botEntry = match.seats.find(s => isBotSession(s.sessionId));
    if (!botEntry || this.matches.matchWinner(match)) {
      this.cancel(matchId);
      return;
    }

    const { phase, turn } = match.state;
    const isBotTurn
      = turn === botEntry.seat
        && (phase === "bidding1" || phase === "bidding2" || phase === "playing");
    if (!isBotTurn) {
      this.cancel(matchId);
      return;
    }

    this.cancel(matchId);
    const delay = MIN_DELAY_MS + Math.random() * (MAX_DELAY_MS - MIN_DELAY_MS);
    this.timers.set(
      matchId,
      setTimeout(() => this.act(matchId, botEntry.sessionId, botEntry.seat, server), delay),
    );
  }

  cancel(matchId: string) {
    const timer = this.timers.get(matchId);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(matchId);
    }
  }

  private act(matchId: string, botSessionId: string, seat: Seat, server: Server) {
    const match = this.matches.get(matchId);
    if (!match)
      return;

    const { phase } = match.state;
    let result: { ok: true } | { error: string };
    if (phase === "bidding1" || phase === "bidding2") {
      result = this.matches.doBid(
        matchId,
        botSessionId,
        this.chooseBid(match.state.bidding, phase, seat, match.state.firstSpeaker),
      );
    }
    else if (phase === "playing") {
      const card = this.choosePlay(match, seat);
      result = card
        ? this.matches.doPlay(matchId, botSessionId, card.id)
        : { error: "no_legal_move" };
    }
    else {
      return;
    }

    if ("error" in result) {
      console.warn("bot action failed", matchId, result.error);
      this.timers.set(
        matchId,
        setTimeout(() => this.poke(matchId, server), 800),
      );
      return;
    }

    // Schedule *before* broadcasting — `broadcast` reads the live deadline
    // via `MatchService`'s provider, so the timer must already reflect the
    // post-move state or the payload ships a stale (or missing) deadline.
    // The bot's move may have just handed the turn to a human — without
    // this, nothing would ever start their clock (the gateway only calls
    // `turnTimer.schedule` for *human*-initiated messages).
    this.turnTimer.schedule(matchId, server);
    this.matches.broadcast(matchId, server);
    this.maybeEmote(matchId, seat, server);
    // State may still (or again, e.g. after a redeal) be the bot's turn.
    this.poke(matchId, server);
  }

  /** Occasional reaction after a bot move, so solo practice isn't dead air. */
  private maybeEmote(matchId: string, seat: Seat, server: Server) {
    if (Math.random() >= BOT_EMOTE_CHANCE)
      return;
    const kind = EMOTE_KINDS[Math.floor(Math.random() * EMOTE_KINDS.length)];
    const payload: EmotePayload = { matchId, seat, kind, ts: Date.now() };
    server.to(`match:${matchId}`).emit("match:emote", payload);
  }

  private chooseBid(
    bidding: { round: 1 | 2; faceUpSuit: string } | null,
    phase: "bidding1" | "bidding2",
    seat: Seat,
    firstSpeaker: Seat | null,
  ): BidAction {
    if (!bidding)
      return { type: "pass" };
    if (phase === "bidding1")
      return Math.random() < 0.5 ? { type: "take" } : { type: "pass" };
    const options = SUITS.filter(s => s !== bidding.faceUpSuit);
    const pick = (): BidAction => ({
      type: "choose",
      suit: options[Math.floor(Math.random() * options.length)]!,
    });
    // Dealer on round 2 must name a suit — no pass.
    if (firstSpeaker && seat !== firstSpeaker)
      return pick();
    return Math.random() < 0.45 ? pick() : { type: "pass" };
  }

  private choosePlay(match: ReturnType<MatchService["get"]>, seat: Seat) {
    if (!match?.state.trump)
      return null;
    const legal = legalMoves(match.state.hands[seat], match.state.trick, match.state.trump);
    if (legal.length === 0)
      return null;
    return legal[Math.floor(Math.random() * legal.length)];
  }
}
