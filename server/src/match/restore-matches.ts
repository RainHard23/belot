import type { Server } from "socket.io";
import type { LobbySeat } from "../lobby/lobby.service";
import { lobby, matches, turnTimer } from "../providers";
import {
  deleteMatchSnapshot,
  loadAllMatchSnapshots,
} from "./match-persist";

/**
 * After boot, rehydrate cash matches from Postgres so a deploy/restart
 * does not vaporize live pots. Practice matches are never persisted.
 */
export async function restorePersistedMatches(server: Server) {
  const rows = await loadAllMatchSnapshots();
  let restored = 0;
  for (const { payload, turnDeadlineAt } of rows) {
    if (payload.settled || payload.practice) {
      await deleteMatchSnapshot(payload.id);
      continue;
    }
    const match = matches.hydrate(payload);
    if (!match)
      continue;

    const seats: (LobbySeat | null)[] = [null, null];
    for (const s of payload.seats) {
      const idx = s.seat === "p0" ? 0 : 1;
      seats[idx] = {
        sessionId: s.sessionId,
        name: s.name,
        userId: s.userId,
      };
    }

    lobby.ensureRestoredTable({
      id: payload.tableId,
      name: payload.tableName,
      buyIn: payload.buyIn,
      target: payload.target,
      seats,
      matchId: payload.id,
      paidSessionIds: payload.paidSessionIds,
    });

    if (turnDeadlineAt && turnDeadlineAt > Date.now() + 200)
      turnTimer.restoreDeadline(payload.id, turnDeadlineAt, server);
    else
      turnTimer.schedule(payload.id, server);

    restored += 1;
  }
  if (restored > 0)
    console.warn(`Restored ${restored} live match(es) from Postgres`);
}
