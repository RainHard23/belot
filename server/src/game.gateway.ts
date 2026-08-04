import type {
  OnGatewayConnection,
  OnGatewayDisconnect,
} from "@nestjs/websockets";
import type { Server, Socket } from "socket.io";
import type { BidAction } from "../../shared/game";
import type { LobbyService } from "./lobby/lobby.service";
import type { MatchService } from "./match/match.service";
import type { SessionService } from "./session/session.service";
import { Inject } from "@nestjs/common";
import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets";
import { LOBBY, MATCH, SESSION } from "./providers";

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

@WebSocketGateway({
  cors: { origin: true, credentials: true },
})
export class GameGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  /** Pending teardown after last socket for a session drops */
  private disconnectTimers = new Map<string, ReturnType<typeof setTimeout>>();

  constructor(
    @Inject(SESSION) private readonly sessions: SessionService,
    @Inject(LOBBY) private readonly lobby: LobbyService,
    @Inject(MATCH) private readonly matches: MatchService,
  ) {}

  handleConnection(client: Socket) {
    try {
      const session = this.sessions.ensure(
        client.handshake.auth?.sessionId as string | undefined,
        client.handshake.auth?.name as string | undefined,
      );
      client.data.sessionId = session.id;
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
            this.matches.broadcast(table.matchId, this.server, { snap: true });
          }
          else {
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
      this.teardownSession(sessionId);
    }, 8_000);
    this.disconnectTimers.set(sessionId, timer);
  }

  private teardownSession(sessionId: string) {
    const match = this.matches.getBySession(sessionId);
    if (match) {
      this.matches.notifyOpponentLeft(match.id, sessionId, this.server);
      this.lobby.setMatch(match.tableId, null);
    }
    this.lobby.leaveAll(sessionId);
    this.server.emit("lobby:tables", this.lobby.list());
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
  sit(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { tableId?: string },
  ) {
    const sessionId = client.data.sessionId as string;
    const session = this.sessions.get(sessionId);
    if (!session)
      return { error: "no_session" };
    if (!body?.tableId || typeof body.tableId !== "string")
      return { error: "invalid_payload" };

    const result = this.lobby.sit(body.tableId, sessionId, session.name);
    if ("error" in result)
      return result;

    client.join(`table:${body.tableId}`);
    this.server.emit("lobby:tables", this.lobby.list());

    const filled = result.table.seats.filter(Boolean).length;
    if (filled === 2 && !result.table.matchId) {
      const target = Number.parseInt(result.table.stakes.replace(/\D/g, ""), 10) || 501;
      const match = this.matches.createFromTable(result.table, target);
      this.lobby.setMatch(body.tableId, match.id);
      const payload = { matchId: match.id, tableId: body.tableId };
      this.server.to(`table:${body.tableId}`).emit("match:start", payload);
      for (const seat of result.table.seats) {
        if (seat) {
          this.server.to(`session:${seat.sessionId}`).emit("match:start", payload);
        }
      }
      this.matches.broadcast(match.id, this.server);
    }

    return {
      ok: true,
      seatIndex: result.seatIndex,
      table: this.lobby.list().find(t => t.id === body.tableId),
    };
  }

  @SubscribeMessage("lobby:leave")
  leave(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { tableId?: string },
  ) {
    const sessionId = client.data.sessionId as string;
    if (!body?.tableId)
      return { error: "invalid_payload" };

    const table = this.lobby.get(body.tableId);
    const matchId = table?.matchId;
    if (matchId) {
      this.matches.notifyOpponentLeft(matchId, sessionId, this.server);
      this.lobby.setMatch(body.tableId, null);
    }

    this.lobby.leave(body.tableId, sessionId);
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
    this.matches.broadcast(body.matchId, this.server);
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
    this.matches.broadcast(body.matchId, this.server);
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
    this.matches.broadcast(body.matchId, this.server);
    return { ok: true };
  }
}
