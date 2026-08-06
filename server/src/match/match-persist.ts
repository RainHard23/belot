import type { MatchState } from "../../../shared/game";
import type { ServerMatch } from "../match/match.service";
import type { Prisma } from "@prisma/client";
import { prisma } from "../db/prisma";

export interface PersistedMatchPayload {
  id: string;
  tableId: string;
  seats: ServerMatch["seats"];
  state: MatchState;
  target: number;
  buyIn: number;
  pot: number;
  practice: boolean;
  settled: boolean;
  tableName?: string;
  paidSessionIds?: string[];
}

export async function saveMatchSnapshot(
  match: ServerMatch,
  turnDeadlineAt: number | null,
  extras?: { tableName?: string; paidSessionIds?: string[] },
) {
  if (match.practice)
    return;
  const payload: PersistedMatchPayload = {
    id: match.id,
    tableId: match.tableId,
    seats: match.seats,
    state: match.state,
    target: match.target,
    buyIn: match.buyIn,
    pot: match.pot,
    practice: match.practice,
    settled: match.settled,
    tableName: extras?.tableName,
    paidSessionIds: extras?.paidSessionIds,
  };
  const json = JSON.parse(JSON.stringify(payload)) as Prisma.InputJsonValue;
  try {
    await prisma.matchSnapshot.upsert({
      where: { id: match.id },
      create: {
        id: match.id,
        tableId: match.tableId,
        payload: json,
        turnDeadlineAt: turnDeadlineAt != null ? BigInt(turnDeadlineAt) : null,
      },
      update: {
        tableId: match.tableId,
        payload: json,
        turnDeadlineAt: turnDeadlineAt != null ? BigInt(turnDeadlineAt) : null,
      },
    });
  }
  catch (err) {
    console.error("saveMatchSnapshot failed", match.id, err);
  }
}

export async function deleteMatchSnapshot(matchId: string) {
  try {
    await prisma.matchSnapshot.delete({ where: { id: matchId } }).catch(() => undefined);
  }
  catch (err) {
    console.error("deleteMatchSnapshot failed", matchId, err);
  }
}

export async function loadAllMatchSnapshots(): Promise<
  { payload: PersistedMatchPayload; turnDeadlineAt: number | null }[]
> {
  try {
    const rows = await prisma.matchSnapshot.findMany();
    return rows.map((row) => {
      const payload = row.payload as unknown as PersistedMatchPayload;
      return {
        payload,
        turnDeadlineAt: row.turnDeadlineAt != null ? Number(row.turnDeadlineAt) : null,
      };
    });
  }
  catch (err) {
    console.error("loadAllMatchSnapshots failed", err);
    return [];
  }
}
