import { randomUUID } from "node:crypto";
import { Injectable } from "@nestjs/common";

export interface LobbySeat {
  sessionId: string;
  name: string;
  userId?: string;
}

const BOT_PREFIX = "bot:";

export function isBotSession(sessionId: string | undefined | null): boolean {
  return typeof sessionId === "string" && sessionId.startsWith(BOT_PREFIX);
}

export function botSessionId(tableId: string): string {
  return `${BOT_PREFIX}${tableId}`;
}

export interface LobbyTable {
  id: string;
  name: string;
  /** Match point target (151 / 301 / 501). */
  target: number;
  /** Entry fee in coins (1 USD = 1 coin). */
  buyIn: number;
  seats: (LobbySeat | null)[];
  matchId: string | null;
  status: "open" | "waiting" | "live";
  /** SessionIds that have paid buy-in for this table seating. */
  paidSessions: Set<string>;
  /** Stable refund tokens per paid seating attempt (sessionId → token). */
  paidTokens: Map<string, string>;
}

const TABLE_NAMES = [
  "Митилини",
  "Афины",
  "Родос",
  "Крит",
  "Санторини",
  "Салоники",
  "Пафос",
  "Никосия",
];

@Injectable()
export class LobbyService {
  private tables = new Map<string, LobbyTable>();

  constructor() {
    for (let i = 1; i <= 12; i++) {
      const id = randomUUID();
      const buyIn = i % 3 === 0 ? 50 : i % 2 === 0 ? 25 : 10;
      const target = i % 3 === 0 ? 501 : i % 2 === 0 ? 301 : 151;
      this.tables.set(id, {
        id,
        name: `${TABLE_NAMES[i % TABLE_NAMES.length]} #${20 + i}`,
        target,
        buyIn,
        seats: [null, null],
        matchId: null,
        status: "open",
        paidSessions: new Set(),
        paidTokens: new Map(),
      });
    }
  }

  list() {
    return [...this.tables.values()].map(t => this.toRow(t));
  }

  private toRow(t: LobbyTable) {
    const filled = t.seats.filter(Boolean).length;
    const status: LobbyTable["status"] = t.matchId
      ? "live"
      : filled === 1
        ? "waiting"
        : "open";
    t.status = status;
    return {
      id: t.id,
      name: t.name,
      game: "Белот",
      type: "1×1",
      players: `${filled}/2`,
      filled,
      stakes: `${t.buyIn}`,
      buyIn: t.buyIn,
      target: t.target,
      seats: t.seats,
      matchId: t.matchId,
      status,
      live: status === "live",
    };
  }

  get(id: string) {
    return this.tables.get(id);
  }

  leaveAll(sessionId: string): string[] {
    const touched: string[] = [];
    for (const t of this.tables.values()) {
      if (t.seats.some(s => s?.sessionId === sessionId)) {
        this.leave(t.id, sessionId);
        touched.push(t.id);
      }
    }
    return touched;
  }

  sit(
    tableId: string,
    sessionId: string,
    name: string,
    userId?: string,
  ): { table: LobbyTable; seatIndex: number; newlySeated: boolean } | { error: string } {
    const table = this.tables.get(tableId);
    if (!table)
      return { error: "table_not_found" };

    for (const other of this.tables.values()) {
      if (other.id === tableId)
        continue;
      if (other.seats.some(s => s?.sessionId === sessionId))
        return { error: "already_seated" };
    }

    if (table.matchId && !table.seats.some(s => s?.sessionId === sessionId)) {
      const free = table.seats.findIndex(s => s === null);
      if (free < 0)
        return { error: "table_full" };
      if (table.seats.filter(Boolean).length < 2) {
        table.matchId = null;
      }
      else {
        return { error: "match_in_progress" };
      }
    }

    const existing = table.seats.findIndex(s => s?.sessionId === sessionId);
    if (existing >= 0) {
      table.seats[existing] = { sessionId, name, userId };
      return { table, seatIndex: existing, newlySeated: false };
    }
    const free = table.seats.findIndex(s => s === null);
    if (free < 0)
      return { error: "table_full" };
    table.seats[free] = { sessionId, name, userId };
    return { table, seatIndex: free, newlySeated: true };
  }

  /**
   * Stable token for one seating / buy-in attempt. Reused for debit + sit-fail
   * refund idempotency so double-click cannot charge twice.
   */
  ensureBuyInToken(tableId: string, sessionId: string): string | null {
    const table = this.tables.get(tableId);
    if (!table)
      return null;
    const existing = table.paidTokens.get(sessionId);
    if (existing)
      return existing;
    const token = randomUUID();
    table.paidTokens.set(sessionId, token);
    return token;
  }

  /** Mark buy-in complete. Pass `token` when re-arming after a failed refund. */
  markPaid(tableId: string, sessionId: string, token?: string) {
    const table = this.tables.get(tableId);
    if (!table)
      return;
    table.paidSessions.add(sessionId);
    if (token)
      table.paidTokens.set(sessionId, token);
    else if (!table.paidTokens.has(sessionId))
      table.paidTokens.set(sessionId, randomUUID());
  }

  clearPaid(tableId: string, sessionId: string) {
    const table = this.tables.get(tableId);
    if (!table)
      return;
    table.paidSessions.delete(sessionId);
    table.paidTokens.delete(sessionId);
  }

  /** After pot settle / forfeit — stop leave-refund from double-paying. */
  clearAllPaid(tableId: string) {
    const table = this.tables.get(tableId);
    if (!table)
      return;
    table.paidSessions.clear();
    table.paidTokens.clear();
  }

  wasPaid(tableId: string, sessionId: string) {
    return this.tables.get(tableId)?.paidSessions.has(sessionId) ?? false;
  }

  /**
   * Synchronously claim a paid seat for refund (prevents concurrent double credit).
   * Returns the seating token for a stable idempotency key, or null.
   */
  claimPaidForRefund(tableId: string, sessionId: string): string | null {
    const table = this.tables.get(tableId);
    if (!table || !table.paidSessions.has(sessionId))
      return null;
    const token = table.paidTokens.get(sessionId) ?? randomUUID();
    table.paidSessions.delete(sessionId);
    table.paidTokens.delete(sessionId);
    return token;
  }

  /** Free every seat after a match ends so winners aren't stuck seated. */
  releaseTable(tableId: string) {
    const table = this.tables.get(tableId);
    if (!table)
      return;
    table.seats = [null, null];
    table.matchId = null;
    table.status = "open";
    table.paidSessions.clear();
    table.paidTokens.clear();
  }

  /**
   * Recreate a table with a known id after server restart so live match
   * snapshots can reattach seats (default lobby tables use random UUIDs).
   */
  ensureRestoredTable(opts: {
    id: string;
    name?: string;
    buyIn: number;
    target: number;
    seats: (LobbySeat | null)[];
    matchId: string;
    paidSessionIds?: string[];
  }): LobbyTable {
    const existing = this.tables.get(opts.id);
    if (existing) {
      existing.seats = opts.seats;
      existing.matchId = opts.matchId;
      existing.buyIn = opts.buyIn;
      existing.target = opts.target;
      existing.paidSessions = new Set(opts.paidSessionIds ?? []);
      existing.paidTokens = new Map(
        (opts.paidSessionIds ?? []).map(id => [id, randomUUID()] as const),
      );
      existing.status = "live";
      return existing;
    }
    const table: LobbyTable = {
      id: opts.id,
      name: opts.name ?? "Восстановленный стол",
      buyIn: opts.buyIn,
      target: opts.target,
      seats: opts.seats,
      matchId: opts.matchId,
      status: "live",
      paidSessions: new Set(opts.paidSessionIds ?? []),
      paidTokens: new Map(
        (opts.paidSessionIds ?? []).map(id => [id, randomUUID()] as const),
      ),
    };
    this.tables.set(opts.id, table);
    return table;
  }

  sitBot(tableId: string, name = "Бот"): { table: LobbyTable; seatIndex: number } | { error: string } {
    const table = this.tables.get(tableId);
    if (!table)
      return { error: "table_not_found" };
    const free = table.seats.findIndex(s => s === null);
    if (free < 0)
      return { error: "table_full" };
    table.seats[free] = { sessionId: botSessionId(tableId), name };
    return { table, seatIndex: free };
  }

  findOpenTable(): LobbyTable | undefined {
    for (const t of this.tables.values()) {
      if (!t.matchId && t.seats.every(s => s === null))
        return t;
    }
    return undefined;
  }

  leave(tableId: string, sessionId: string) {
    const table = this.tables.get(tableId);
    if (!table)
      return;
    table.seats = table.seats.map(s =>
      s?.sessionId === sessionId ? null : s,
    ) as (LobbySeat | null)[];
    // Paid flags are claimed before wallet refund — don't wipe unpaid claims here.
    if (table.seats.every(s => s === null)) {
      table.matchId = null;
      table.status = "open";
      if (table.paidSessions.size === 0)
        table.paidTokens.clear();
    }
  }

  setMatch(tableId: string, matchId: string | null) {
    const table = this.tables.get(tableId);
    if (table)
      table.matchId = matchId;
  }

  findBySession(sessionId: string): LobbyTable | undefined {
    for (const t of this.tables.values()) {
      if (t.seats.some(s => s?.sessionId === sessionId))
        return t;
    }
    return undefined;
  }

  clearMatchIfEmpty(tableId: string) {
    const table = this.tables.get(tableId);
    if (!table)
      return;
    if (table.seats.filter(Boolean).length < 2)
      table.matchId = null;
  }
}
