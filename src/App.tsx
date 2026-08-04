import { MotionConfig } from "motion/react";
import { useCallback, useState } from "react";
import { useLobbyStore } from "./store/lobbyStore";
import { useMatchStore } from "./store/matchStore";
import { LobbyScreen } from "./ui/lobby/LobbyScreen";
import { MatchScreen } from "./ui/match/MatchScreen";
import { NameGate } from "./ui/NameGate";

function hasName() {
  return Boolean(sessionStorage.getItem("bilot_name")?.trim());
}

export default function App() {
  const [named, setNamed] = useState(hasName);
  const [screen, setScreen] = useState<"lobby" | "match">("lobby");
  const [matchId, setMatchId] = useState<string | null>(null);
  const leaveLobbyTable = useLobbyStore(s => s.leave);
  const seatedTableId = useLobbyStore(s => s.seatedTableId);
  const setName = useLobbyStore(s => s.setName);
  const clearMatchNav = useLobbyStore(s => s.clearMatchNav);
  const clearMatch = useMatchStore(s => s.clear);

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
    setNamed(true);
  };

  return (
    <MotionConfig reducedMotion="user">
      {!named
        ? (
            <NameGate
              initial={sessionStorage.getItem("bilot_name") ?? ""}
              onDone={onName}
            />
          )
        : screen === "match" && matchId
          ? <MatchScreen matchId={matchId} onLeave={onLeave} />
          : (
              <LobbyScreen
                onEnterMatch={onEnterMatch}
                onEditName={() => setNamed(false)}
              />
            )}
    </MotionConfig>
  );
}
