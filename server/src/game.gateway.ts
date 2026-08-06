import type {
  OnGatewayConnection,
  OnGatewayDisconnect,
} from "@nestjs/websockets";
import type { Server, Socket } from "socket.io";
import type { BidAction } from "../../shared/game";
import type { EmotePayload } from "../../shared/net/protocol";
import type { AuthService } from "./auth/auth.service";
import type { LobbyService } from "./lobby/lobby.service";
import type { BotService } from "./match/bot.service";
import type { MatchService, ServerMatch } from "./match/match.service";
import type { TurnTimerService } from "./match/turn-timer.service";
import type { SessionService } from "./session/session.service";
import type { WalletService } from "./wallet/wallet.service";
import { Inject } from "@nestjs/common";
import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets";
import { isEmoteKind } from "../../shared/net/protocol";
import { isBotSession } from "./lobby/lobby.service";
import { AUTH, BOT, LOBBY, MATCH, SESSION, TURN_TIMER, WALLET } from "./providers";
import { SlidingWindowLimiter } from "./rate-limiter";

const EMOTE_WINDOW_MS = 10_000;
const EMOTE_MAX_PER_WINDOW = 5;
/** Refresh / network blip grace before forfeit (was 8s — too aggressive for cash). */
const DISCONNECT_GRACE_MS = 60_000;

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

@WebSocketGateway({
  cors: { origin: true, credentials: true },
})
export class GameGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private disconnectTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private emoteLimiter = new SlidingWindowLimiter(EMOTE_MAX_PER_WINDOW, EMOTE_WINDOW_MS);

  constructor(
    @Inject(AUTH) private readonly auth: AuthService,
    @Inject(WALLET) private readonly wallet: WalletService,
    @Inject(SESSION) private readonly sessions: SessionService,
    @Inject(LOBBY) private readonly lobby: LobbyService,
    @Inject(MATCH) private readonly matches: MatchService,
    @Inject(BOT) private readonly bot: BotService,
    @Inject(TURN_TIMER) private readonly turnTimer: TurnTimerService,
  ) {}

  handleConnection(client: Socket) {
    try {
      const token = client.handshake.auth?.token as string | undefined;
      if (!token) {
        client.emit("auth:error", { message: "Нужна авторизация" });
        client.disconnect(true);
        return;
      }

      let session;
      try {
        const payload = this.auth.verifyToken(token);
        session = this.sessions.ensureAuth(payload.sub, payload.name);
      }
      catch {
        client.emit("auth:error", { message: "Сессия истекла — войдите снова" });
        client.disconnect(true);
        return;
      }

      client.data.sessionId = session.id;
      client.data.userId = session.userId;
      client.join(`session:${session.id}`);

      const pending = this.disconnectTimers.get(session.id);
      if (pending) {
        clearTimeout(pending);
        this.disconnectTimers.delete(session.id);
      }

      client.emit("session", session);
      client.emit("lobby:tables", this.lobby.list());

      const table = this.lobby.findBySession(session.id);
      if (table) {
        client.join(`table:${table.id}`);
        client.emit("lobby:resumed", {
          tableId: table.id,
          matchId: table.matchId,
        });
        if (table.matchId) {
          const match = this.matches.get(table.matchId);
          if (match && this.matches.seatOf(match, session.id)) {
            client.join(`match:${table.matchId}`);
            client.emit("match:start", {
              matchId: table.matchId,
              tableId: table.id,
            });
            this.turnTimer.schedule(table.matchId, this.server, { preserveDeadline: true });
            this.matches.broadcast(table.matchId, this.server, { snap: true });
          }
          else if (!match) {
            // Stale pointer after crash/end — don't touch a live match we're not in.
            this.lobby.setMatch(table.id, null);
          }
        }
      }
    }
    catch (err) {
      console.error("handleConnection failed", err);
      client.emit("error", { message: "session_failed" });
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket) {
    const sessionId = client.data.sessionId as string | undefined;
    if (!sessionId)
      return;
    const existing = this.disconnectTimers.get(sessionId);
    if (existing)
      clearTimeout(existing);

    const timer = setTimeout(() => {
      this.disconnectTimers.delete(sessionId);
      const room = this.server.sockets.adapter.rooms.get(`session:${sessionId}`);
      if (room && room.size > 0)
        return;
      void this.teardownSession(sessionId);
    }, DISCONNECT_GRACE_MS);
    this.disconnectTimers.set(sessionId, timer);
  }

  private async teardownSession(sessionId: string) {
    const match = this.matches.getBySession(sessionId);
    if (match) {
      this.bot.cancel(match.id);
      this.turnTimer.cancel(match.id);
      const winner = this.matches.matchWinner(match);
      if (winner) {
        if (!match.settled)
          await this.ensureMatchSettled(match);
        for (const s of match.seats) {
          if (s.sessionId === sessionId)
            continue;
          this.server.to(`session:${s.sessionId}`).emit("match:ended", {
            matchId: match.id,
            reason: "ended",
          });
        }
        this.matches.endMatch(match.id);
      }
      else {
        if (!match.settled) {
          await this.handleForfeit(match, sessionId);
          if (!match.settled && !match.practice && match.pot > 0)
            await this.emergencyRefundMatch(match);
        }
        this.matches.notifyOpponentLeft(match.id, sessionId, this.server);
      }
      this.lobby.releaseTable(match.tableId);
    }

    const waiting = this.lobby.findBySession(sessionId);
    if (waiting && !waiting.matchId)
      await this.refundIfPaidNoMatch(waiting.id, sessionId);

    const touched = this.lobby.leaveAll(sessionId);
    for (const tableId of touched)
      this.vacateBotIfAlone(tableId);
    this.emoteLimiter.reset(sessionId);
    this.server.emit("lobby:tables", this.lobby.list());
  }

  private vacateBotIfAlone(tableId: string) {
    const table = this.lobby.get(tableId);
    if (!table)
      return;
    const remaining = table.seats.filter((s): s is NonNullable<typeof s> => s !== null);
    if (remaining.length === 1 && isBotSession(remaining[0].sessionId))
      this.lobby.leave(tableId, remaining[0].sessionId);
  }

  @SubscribeMessage("session:name")
  setName(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { name?: string },
  ) {
    const sessionId = client.data.sessionId as string;
    if (!body?.name)
      return { error: "invalid_payload" };
    const session = this.sessions.setName(sessionId, body.name);
    if (!session)
      return { error: "no_session" };
    client.emit("session", session);
    return { ok: true, session };
  }

  @SubscribeMessage("lobby:list")
  list() {
    return this.lobby.list();
  }

  @SubscribeMessage("lobby:sit")
  async sit(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { tableId?: string },
  ) {
    const sessionId = client.data.sessionId as string;
    const session = this.sessions.get(sessionId);
    if (!session)
      return { error: "no_session" };
    if (!body?.tableId || typeof body.tableId !== "string")
      return { error: "invalid_payload" };

    const table = this.lobby.get(body.tableId);
    if (!table)
      return { error: "table_not_found" };

    // Already seated at this table — refresh seat metadata, no re-debit.
    const existingIdx = table.seats.findIndex(s => s?.sessionId === sessionId);
    if (existingIdx < 0) {
      if (table.matchId)
        return { error: "match_in_progress" };
      const free = table.seats.findIndex(s => s === null);
      if (free < 0)
        return { error: "table_full" };

      // Charge *before* seating so a crash cannot leave an unpaid seated player.
      if (table.buyIn > 0 && session.userId) {
        const buyInToken = this.lobby.ensureBuyInToken(body.tableId, sessionId);
        if (!buyInToken)
          return { error: "table_not_found" };
        try {
          await this.wallet.debit({
            userId: session.userId,
            amount: table.buyIn,
            type: "buyin",
            idempotencyKey: `buyin:${body.tableId}:${sessionId}:${buyInToken}`,
            refType: "table",
            refId: body.tableId,
          });
        }
        catch {
          this.lobby.clearPaid(body.tableId, sessionId);
          return { error: "insufficient_funds" };
        }
      }
    }

    const preview = this.lobby.sit(body.tableId, sessionId, session.name, session.userId);
    if ("error" in preview) {
      // Rare: seat lost between check and sit after debit — refund.
      if (existingIdx < 0 && table.buyIn > 0 && session.userId) {
        const token = this.lobby.ensureBuyInToken(body.tableId, sessionId);
        try {
          if (token) {
            await this.wallet.credit({
              userId: session.userId,
              amount: table.buyIn,
              type: "refund",
              idempotencyKey: `refund:sitfail:${body.tableId}:${sessionId}:${token}`,
              refType: "table",
              refId: body.tableId,
            });
            this.lobby.clearPaid(body.tableId, sessionId);
          }
        }
        catch (err) {
          console.error("sit-fail refund failed", err);
        }
      }
      return preview;
    }

    if (preview.newlySeated && table.buyIn > 0 && session.userId)
      this.lobby.markPaid(body.tableId, sessionId);

    client.join(`table:${body.tableId}`);
    this.server.emit("lobby:tables", this.lobby.list());

    const filled = preview.table.seats.filter(Boolean).length;
    if (filled === 2 && !preview.table.matchId) {
      const humans = preview.table.seats.filter(
        (s): s is NonNullable<typeof s> => s !== null && !isBotSession(s.sessionId),
      );
      const allPaid = table.buyIn <= 0
        || humans.every(s => this.lobby.wasPaid(body.tableId!, s.sessionId));
      if (allPaid) {
        const match = this.matches.createFromTable(preview.table, {
          practice: false,
          target: preview.table.target,
        });
        this.lobby.setMatch(body.tableId, match.id);
        const payload = { matchId: match.id, tableId: body.tableId };
        this.server.to(`table:${body.tableId}`).emit("match:start", payload);
        for (const seat of preview.table.seats) {
          if (seat)
            this.server.to(`session:${seat.sessionId}`).emit("match:start", payload);
        }
        this.turnTimer.schedule(match.id, this.server);
        this.matches.broadcast(match.id, this.server);
        this.bot.poke(match.id, this.server);
      }
    }

    return {
      ok: true,
      seatIndex: preview.seatIndex,
      table: this.lobby.list().find(t => t.id === body.tableId),
    };
  }

  /** Solo practice — no buy-in. */
  @SubscribeMessage("lobby:practice")
  practice(@ConnectedSocket() client: Socket) {
    const sessionId = client.data.sessionId as string;
    const session = this.sessions.get(sessionId);
    if (!session)
      return { error: "no_session" };

    const openTable = this.lobby.findOpenTable();
    if (!openTable)
      return { error: "table_full" };

    const sitResult = this.lobby.sit(openTable.id, sessionId, session.name, session.userId);
    if ("error" in sitResult)
      return sitResult;
    const botResult = this.lobby.sitBot(openTable.id);
    if ("error" in botResult) {
      this.lobby.leave(openTable.id, sessionId);
      return botResult;
    }

    client.join(`table:${openTable.id}`);
    this.server.emit("lobby:tables", this.lobby.list());

    const match = this.matches.createFromTable(botResult.table, {
      practice: true,
      target: botResult.table.target,
    });
    this.lobby.setMatch(openTable.id, match.id);

    const payload = { matchId: match.id, tableId: openTable.id };
    this.server.to(`session:${sessionId}`).emit("match:start", payload);
    this.turnTimer.schedule(match.id, this.server);
    this.matches.broadcast(match.id, this.server);
    this.bot.poke(match.id, this.server);

    return { ok: true, ...payload };
  }

  @SubscribeMessage("lobby:leave")
  async leave(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { tableId?: string },
  ) {
    const sessionId = client.data.sessionId as string;
    if (!body?.tableId)
      return { error: "invalid_payload" };

    const table = this.lobby.get(body.tableId);
    const matchId = table?.matchId;
    if (matchId) {
      const match = this.matches.get(matchId);
      this.bot.cancel(matchId);
      this.turnTimer.cancel(matchId);
      const winner = match ? this.matches.matchWinner(match) : null;
      if (match && winner) {
        // Match already decided — settle if needed, then tear down quietly.
        // Still notify the other seat so their lobby seat state clears.
        if (!match.settled)
          await this.ensureMatchSettled(match);
        for (const s of match.seats) {
          if (s.sessionId === sessionId)
            continue;
          this.server.to(`session:${s.sessionId}`).emit("match:ended", {
            matchId,
            reason: "ended",
          });
        }
        this.matches.endMatch(matchId);
      }
      else if (match) {
        // Mid-match leave → forfeit + tell remaining player (even if settle set settled).
        if (!match.settled) {
          await this.handleForfeit(match, sessionId);
          if (!match.settled && !match.practice && match.pot > 0)
            await this.emergencyRefundMatch(match);
        }
        this.matches.notifyOpponentLeft(matchId, sessionId, this.server);
      }
      this.lobby.releaseTable(body.tableId);
    }
    else {
      await this.refundIfPaidNoMatch(body.tableId, sessionId);
      this.lobby.leave(body.tableId, sessionId);
      this.vacateBotIfAlone(body.tableId);
    }

    client.leave(`table:${body.tableId}`);
    this.server.emit("lobby:tables", this.lobby.list());
    return { ok: true };
  }

  @SubscribeMessage("match:join")
  joinMatch(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { matchId?: string },
  ) {
    const sessionId = client.data.sessionId as string;
    if (!body?.matchId)
      return { error: "invalid_payload" };
    const match = this.matches.get(body.matchId);
    if (!match)
      return { error: "no_match" };
    if (!this.matches.seatOf(match, sessionId))
      return { error: "not_seated" };

    client.join(`session:${sessionId}`);
    client.join(`match:${body.matchId}`);
    this.turnTimer.schedule(body.matchId, this.server, { preserveDeadline: true });
    this.matches.broadcast(body.matchId, this.server, { snap: true });
    return { ok: true };
  }

  @SubscribeMessage("match:bid")
  bid(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { matchId?: string; action?: BidAction },
  ) {
    const sessionId = client.data.sessionId as string;
    if (!body?.matchId || !body.action || !isRecord(body.action))
      return { error: "invalid_payload" };
    const result = this.matches.doBid(body.matchId, sessionId, body.action);
    if ("error" in result)
      return result;
    this.turnTimer.schedule(body.matchId, this.server);
    this.matches.broadcast(body.matchId, this.server);
    this.bot.poke(body.matchId, this.server);
    return { ok: true };
  }

  @SubscribeMessage("match:play")
  play(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { matchId?: string; cardId?: string },
  ) {
    const sessionId = client.data.sessionId as string;
    if (!body?.matchId || typeof body.cardId !== "string")
      return { error: "invalid_payload" };
    const result = this.matches.doPlay(body.matchId, sessionId, body.cardId);
    if ("error" in result)
      return result;
    this.turnTimer.schedule(body.matchId, this.server);
    this.matches.broadcast(body.matchId, this.server);
    this.bot.poke(body.matchId, this.server);
    return { ok: true };
  }

  @SubscribeMessage("match:nextHand")
  nextHand(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { matchId?: string },
  ) {
    const sessionId = client.data.sessionId as string;
    if (!body?.matchId)
      return { error: "invalid_payload" };
    const result = this.matches.nextHand(body.matchId, sessionId);
    if ("error" in result)
      return result;
    this.turnTimer.schedule(body.matchId, this.server);
    this.matches.broadcast(body.matchId, this.server);
    this.bot.poke(body.matchId, this.server);
    return { ok: true };
  }

  @SubscribeMessage("match:emote")
  emote(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { matchId?: string; kind?: string },
  ) {
    const sessionId = client.data.sessionId as string;
    if (!body?.matchId || !isEmoteKind(body.kind))
      return { error: "invalid_payload" };
    const match = this.matches.get(body.matchId);
    if (!match)
      return { error: "no_match" };
    const seat = this.matches.seatOf(match, sessionId);
    if (!seat)
      return { error: "not_seated" };

    if (!this.emoteLimiter.tryConsume(sessionId))
      return { error: "rate_limited" };

    const payload: EmotePayload = { matchId: body.matchId, seat, kind: body.kind, ts: Date.now() };
    this.server.to(`match:${body.matchId}`).emit("match:emote", payload);
    return { ok: true };
  }

  /** Mid-match leave: remaining human wins pot (90/10). */
  private async handleForfeit(match: ServerMatch, leaverSessionId: string) {
    // Wait out an in-flight settle so we don't race into emergencyRefundMatch.
    const waitStart = Date.now();
    while (match.settling && Date.now() - waitStart < 8_000)
      await new Promise(r => setTimeout(r, 50));

    if (match.settled || match.practice || match.pot <= 0) {
      match.settled = true;
      this.lobby.clearAllPaid(match.tableId);
      return;
    }
    const winner = match.seats.find(
      s => s.sessionId !== leaverSessionId && !isBotSession(s.sessionId),
    );
    match.settling = true;
    try {
      if (!winner?.userId) {
        for (const s of match.seats) {
          if (s.userId && !isBotSession(s.sessionId) && match.buyIn > 0) {
            try {
              await this.wallet.credit({
                userId: s.userId,
                amount: match.buyIn,
                type: "refund",
                idempotencyKey: `refund:forfeit:${match.id}:${s.sessionId}`,
                refType: "match",
                refId: match.id,
              });
            }
            catch (err) {
              console.error("refund failed", err);
            }
          }
        }
      }
      else {
        await this.wallet.settleMatch({
          matchId: match.id,
          pot: match.pot,
          winnerUserId: winner.userId,
        });
      }
      match.settled = true;
      this.lobby.clearAllPaid(match.tableId);
    }
    catch (err) {
      console.error("forfeit settle failed", err);
      // Don't mark settled — emergencyRefundMatch checks hasMatchPayout first.
    }
    finally {
      match.settling = false;
    }
  }

  /** Finish points/bolts payout before tearing the match down. */
  private async ensureMatchSettled(match: ServerMatch) {
    const waitStart = Date.now();
    while (match.settling && Date.now() - waitStart < 8_000)
      await new Promise(r => setTimeout(r, 50));

    if (match.settled || match.practice || match.pot <= 0) {
      match.settled = true;
      this.lobby.clearAllPaid(match.tableId);
      return;
    }
    const winner = this.matches.matchWinner(match);
    if (!winner)
      return;
    const winnerSeat = match.seats.find(s => s.seat === winner.seat);
    match.settling = true;
    try {
      if (winnerSeat?.userId && !isBotSession(winnerSeat.sessionId)) {
        await this.wallet.settleMatch({
          matchId: match.id,
          pot: match.pot,
          winnerUserId: winnerSeat.userId,
        });
      }
      match.settled = true;
      this.lobby.clearAllPaid(match.tableId);
    }
    catch (err) {
      console.error("ensureMatchSettled failed", err);
      if (!(await this.wallet.hasMatchPayout(match.id)))
        await this.emergencyRefundMatch(match);
      else {
        match.settled = true;
        this.lobby.clearAllPaid(match.tableId);
      }
    }
    finally {
      match.settling = false;
    }
  }

  /** Last-resort: return buy-ins only when no winner payout was written. */
  private async emergencyRefundMatch(match: ServerMatch) {
    if (await this.wallet.hasMatchPayout(match.id)) {
      match.settled = true;
      this.lobby.clearAllPaid(match.tableId);
      return;
    }
    for (const s of match.seats) {
      if (!s.userId || isBotSession(s.sessionId) || match.buyIn <= 0)
        continue;
      try {
        await this.wallet.credit({
          userId: s.userId,
          amount: match.buyIn,
          type: "refund",
          idempotencyKey: `refund:emergency:${match.id}:${s.sessionId}`,
          refType: "match",
          refId: match.id,
        });
      }
      catch (err) {
        console.error("emergency refund failed", err);
      }
    }
    match.settled = true;
    this.lobby.clearAllPaid(match.tableId);
  }

  private async refundIfPaidNoMatch(tableId: string, sessionId: string) {
    const table = this.lobby.get(tableId);
    if (!table || table.matchId)
      return;
    const token = this.lobby.claimPaidForRefund(tableId, sessionId);
    if (!token)
      return;
    const session = this.sessions.get(sessionId);
    if (!session?.userId || table.buyIn <= 0)
      return;
    try {
      await this.wallet.credit({
        userId: session.userId,
        amount: table.buyIn,
        type: "refund",
        idempotencyKey: `refund:leave:${tableId}:${token}`,
        refType: "table",
        refId: tableId,
      });
    }
    catch (err) {
      console.error("leave refund failed", err);
      // Re-arm with the *same* token so a retry keeps the idempotency key.
      this.lobby.markPaid(tableId, sessionId, token);
    }
  }
}
