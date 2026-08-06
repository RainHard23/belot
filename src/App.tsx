import { MotionConfig } from "motion/react";
import { useCallback, useEffect, useState } from "react";
import { useAuthStore } from "./store/authStore";
import { useLobbyStore } from "./store/lobbyStore";
import { useMatchStore } from "./store/matchStore";
import { AuthGate } from "./ui/AuthGate";
import { LobbyScreen } from "./ui/lobby/LobbyScreen";
import { MatchScreen } from "./ui/match/MatchScreen";
import { NameGate } from "./ui/NameGate";

export default function App() {
  const token = useAuthStore(s => s.token);
  const user = useAuthStore(s => s.user);
  const ready = useAuthStore(s => s.ready);
  const hydrate = useAuthStore(s => s.hydrate);
  const logout = useAuthStore(s => s.logout);

  const [editingName, setEditingName] = useState(false);
  const [screen, setScreen] = useState<"lobby" | "match">("lobby");
  const [matchId, setMatchId] = useState<string | null>(null);

  const leaveLobbyTable = useLobbyStore(s => s.leave);
  const seatedTableId = useLobbyStore(s => s.seatedTableId);
  const setName = useLobbyStore(s => s.setName);
  const clearMatchNav = useLobbyStore(s => s.clearMatchNav);
  const clearMatch = useMatchStore(s => s.clear);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  const onEnterMatch = useCallback((id: string) => {
    setMatchId(id);
    setScreen("match");
  }, []);

  const onLeave = () => {
    if (seatedTableId)
      leaveLobbyTable(seatedTableId);
    clearMatch();
    clearMatchNav();
    setMatchId(null);
    setScreen("lobby");
  };

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
