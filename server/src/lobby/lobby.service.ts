import { randomUUID } from "node:crypto";
import { Injectable } from "@nestjs/common";

export interface LobbySeat {
  sessionId: string;
  name: string;
}

export interface LobbyTable {
  id: string;
  name: string;
  /** Display label: target points */
  stakes: string;
  seats: (LobbySeat | null)[];
  matchId: string | null;
  status: "open" | "waiting" | "live";
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
      this.tables.set(id, {
        id,
        name: `${TABLE_NAMES[i % TABLE_NAMES.length]} #${20 + i}`,
        stakes: i % 3 === 0 ? "до 501" : i % 2 === 0 ? "до 301" : "до 151",
        seats: [null, null],
        matchId: null,
        status: "open",
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
      stakes: t.stakes,
      target: Number.parseInt(t.stakes.replace(/\D/g, ""), 10) || 501,
      seats: t.seats,
      matchId: t.matchId,
      status,
      live: status === "live",
    };
  }

  get(id: string) {
    return this.tables.get(id);
  }

  /** Leave every table this session occupies */
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
  ): { table: LobbyTable; seatIndex: number } | { error: string } {
    const table = this.tables.get(tableId);
    if (!table)
      return { error: "table_not_found" };

    // One table per session
    for (const other of this.tables.values()) {
      if (other.id === tableId)
        continue;
      if (other.seats.some(s => s?.sessionId === sessionId))
        this.leave(other.id, sessionId);
    }

    // Can't join a live match seat as a third player
    if (table.matchId && !table.seats.some(s => s?.sessionId === sessionId)) {
      const free = table.seats.findIndex(s => s === null);
      if (free < 0)
        return { error: "table_full" };
      // Stale match with empty seat — clear and allow reseat
      if (table.seats.filter(Boolean).length < 2) {
        table.matchId = null;
      }
      else {
        return { error: "match_in_progress" };
      }
    }

    const existing = table.seats.findIndex(s => s?.sessionId === sessionId);
    if (existing >= 0) {
      table.seats[existing] = { sessionId, name };
      return { table, seatIndex: existing };
    }
    const free = table.seats.findIndex(s => s === null);
    if (free < 0)
      return { error: "table_full" };
    table.seats[free] = { sessionId, name };
    return { table, seatIndex: free };
  }

  leave(tableId: string, sessionId: string) {
    const table = this.tables.get(tableId);
    if (!table)
      return;
    table.seats = table.seats.map(s =>
      s?.sessionId === sessionId ? null : s,
    ) as (LobbySeat | null)[];
    if (table.seats.every(s => s === null)) {
      table.matchId = null;
      table.status = "open";
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
