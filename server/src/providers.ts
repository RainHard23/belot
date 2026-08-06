import { LobbyService } from "./lobby/lobby.service";
import { BotService } from "./match/bot.service";
import { MatchService } from "./match/match.service";
import { TurnTimerService } from "./match/turn-timer.service";
import { SessionService } from "./session/session.service";

export const SESSION = "SESSION_SERVICE";
export const LOBBY = "LOBBY_SERVICE";
export const MATCH = "MATCH_SERVICE";
export const BOT = "BOT_SERVICE";
export const TURN_TIMER = "TURN_TIMER_SERVICE";

export const sessions = new SessionService();
export const lobby = new LobbyService();
export const matches = new MatchService();
// turnTimer before bot: BotService also schedules the *next* (human) turn's
// clock right after it moves, so it needs a constructed TurnTimerService.
export const turnTimer = new TurnTimerService(matches);
export const bot = new BotService(matches, turnTimer);

// Wire the deadline lookup + bot wake-up after both singletons exist (see
// the comments on `MatchService.setDeadlineProvider` /
// `TurnTimerService.setBotPoke`) instead of a circular constructor dep.
matches.setDeadlineProvider(matchId => turnTimer.deadlineFor(matchId));
turnTimer.setBotPoke((matchId, server) => bot.poke(matchId, server));
