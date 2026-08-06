import { LobbyService, isBotSession } from "./lobby/lobby.service";
import { BotService } from "./match/bot.service";
import { MatchService } from "./match/match.service";
import { TurnTimerService } from "./match/turn-timer.service";
import { SessionService } from "./session/session.service";
import { AuthService } from "./auth/auth.service";
import { WalletService } from "./wallet/wallet.service";
import { MockDepositProvider } from "./wallet/mock-deposit.provider";

export const AUTH = "AUTH_SERVICE";
export const WALLET = "WALLET_SERVICE";
export const SESSION = "SESSION_SERVICE";
export const LOBBY = "LOBBY_SERVICE";
export const MATCH = "MATCH_SERVICE";
export const BOT = "BOT_SERVICE";
export const TURN_TIMER = "TURN_TIMER_SERVICE";

export const wallet = new WalletService();
export const auth = new AuthService(wallet);
export const mockDeposit = new MockDepositProvider(wallet);
export const sessions = new SessionService();
export const lobby = new LobbyService();
export const matches = new MatchService();
export const turnTimer = new TurnTimerService(matches);
export const bot = new BotService(matches, turnTimer);

matches.setDeadlineProvider(matchId => turnTimer.deadlineFor(matchId));
turnTimer.setBotPoke((matchId, server) => bot.poke(matchId, server));

matches.setPersistMeta((match) => {
  const table = lobby.get(match.tableId);
  return {
    tableName: table?.name,
    paidSessionIds: table ? [...table.paidSessions] : [],
  };
});

matches.setSettleHook(async (match) => {
  if (match.settled || match.settling || match.practice || match.pot <= 0)
    return;
  const winner = matches.matchWinner(match);
  if (!winner)
    return;
  const winnerSeat = match.seats.find(s => s.seat === winner.seat);
  if (!winnerSeat?.userId || isBotSession(winnerSeat.sessionId)) {
    match.settled = true;
    lobby.clearAllPaid(match.tableId);
    return;
  }
  // Mark settling *before* await so a crash mid-payout still leaves the
  // Postgres snapshot intact (settled stays false → restore on reboot).
  match.settling = true;
  try {
    await wallet.settleMatch({
      matchId: match.id,
      pot: match.pot,
      winnerUserId: winnerSeat.userId,
    });
    match.settled = true;
    lobby.clearAllPaid(match.tableId);
  }
  catch (err) {
    console.error("settleHook failed", err);
    // Keep unsettled so leave/ensureMatchSettled can retry or emergency-refund.
  }
  finally {
    match.settling = false;
  }
});
