import { LobbyService } from "./lobby/lobby.service";
import { MatchService } from "./match/match.service";
import { SessionService } from "./session/session.service";

export const SESSION = "SESSION_SERVICE";
export const LOBBY = "LOBBY_SERVICE";
export const MATCH = "MATCH_SERVICE";

export const sessions = new SessionService();
export const lobby = new LobbyService();
export const matches = new MatchService();
