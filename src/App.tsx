import { MotionConfig } from "motion/react";
import { useCallback, useEffect, useState } from "react";
import { useAuthStore } from "./store/authStore";
import { useLobbyStore } from "./store/lobbyStore";
import { useMatchStore } from "./store/matchStore";
import { AuthGate } from "./ui/AuthGate";
import { LobbyScreen } from "./ui/lobby/LobbyScreen";
import { MatchScreen } from "./ui/match/MatchScreen";
import { NameGate } from "./ui/NameGate";

const ACTIVE_MATCH_KEY = "bilot_active_match";

function readStoredMatchId(): string | null {
  try {
    return sessionStorage.getItem(ACTIVE_MATCH_KEY);
  }
  catch {
    return null;
  }
}

function writeStoredMatchId(id: string | null) {
  try {
    if (id)
      sessionStorage.setItem(ACTIVE_MATCH_KEY, id);
    else
      sessionStorage.removeItem(ACTIVE_MATCH_KEY);
  }
  catch {
    /* private mode / blocked storage */
  }
}

export default function App() {
  const token = useAuthStore(s => s.token);
  const user = useAuthStore(s => s.user);
  const ready = useAuthStore(s => s.ready);
  const hydrate = useAuthStore(s => s.hydrate);
  const logout = useAuthStore(s => s.logout);

  const [editingName, setEditingName] = useState(false);
  const storedMatch = readStoredMatchId();
  const [screen, setScreen] = useState<"lobby" | "match">(storedMatch ? "match" : "lobby");
  const [matchId, setMatchId] = useState<string | null>(storedMatch);

  const leaveLobbyTable = useLobbyStore(s => s.leave);
  const seatedTableId = useLobbyStore(s => s.seatedTableId);
  const lobbyMatchId = useLobbyStore(s => s.matchId);
  const setName = useLobbyStore(s => s.setName);
  const clearMatchNav = useLobbyStore(s => s.clearMatchNav);
  const clearMatch = useMatchStore(s => s.clear);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  // Bind lobby/socket listeners even when we F5 straight into a match
  // (otherwise only LobbyScreen called connect, and resume events were missed).
  useEffect(() => {
    if (token && user)
      useLobbyStore.getState().connect();
  }, [token, user]);

  // Server resume (`lobby:resumed` / `match:start`) wins over sessionStorage.
  useEffect(() => {
    if (lobbyMatchId) {
      setMatchId(lobbyMatchId);
      setScreen("match");
      writeStoredMatchId(lobbyMatchId);
    }
  }, [lobbyMatchId]);

  const onEnterMatch = useCallback((id: string) => {
    setMatchId(id);
    setScreen("match");
    writeStoredMatchId(id);
  }, []);

  const onLeave = useCallback((opts?: { soft?: boolean }) => {
    // Soft = match already gone on server (opponent left / stale id) — don't
    // emit lobby:leave again (avoids spurious refund / double teardown).
    if (!opts?.soft && seatedTableId)
      leaveLobbyTable(seatedTableId);
    clearMatch();
    clearMatchNav();
    writeStoredMatchId(null);
    setMatchId(null);
    setScreen("lobby");
  }, [seatedTableId, leaveLobbyTable, clearMatch, clearMatchNav]);

  const onName = (name: string) => {
    sessionStorage.setItem("bilot_name", name);
    setName(name);
    setEditingName(false);
  };

  const onLogout = () => {
    if (seatedTableId)
      leaveLobbyTable(seatedTableId);
    clearMatch();
    clearMatchNav();
    writeStoredMatchId(null);
    setMatchId(null);
    setScreen("lobby");
    setEditingName(false);
    void logout();
  };

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#19191d] text-[#74747c]">
        …
      </div>
    );
  }

  if (!token || !user)
    return <AuthGate />;

  return (
    <MotionConfig reducedMotion="user">
      {editingName
        ? (
            <NameGate
              initial={user.displayName}
              onDone={onName}
            />
          )
        : screen === "match" && matchId
          ? <MatchScreen matchId={matchId} onLeave={onLeave} />
          : (
              <LobbyScreen
                onEnterMatch={onEnterMatch}
                onEditName={() => setEditingName(true)}
                onLogout={onLogout}
              />
            )}
    </MotionConfig>
  );
}
