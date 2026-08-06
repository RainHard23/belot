import { create } from "zustand";
import { errText } from "@/ui/i18n/ru";
import { getSocket } from "../net/socket";

export interface LobbyTableRow {
  id: string;
  name: string;
  game: string;
  type: string;
  players: string;
  filled: number;
  stakes: string;
  buyIn?: number;
  target?: number;
  seats: ({ sessionId: string; name: string } | null)[];
  matchId: string | null;
  status?: "open" | "waiting" | "live";
  live?: boolean;
}

interface LobbyState {
  connected: boolean;
  session: { id: string; name: string } | null;
  tables: LobbyTableRow[];
  selectedId: string | null;
  matchId: string | null;
  seatedTableId: string | null;
  status: string | null;
  connect: () => void;
  select: (id: string) => void;
  sit: (tableId: string) => void;
  /** Solo practice table — a bot fills the other seat and the match starts right away. */
  playBot: () => void;
  leave: (tableId: string) => void;
  setName: (name: string) => void;
  clearMatchNav: () => void;
}

export const useLobbyStore = create<LobbyState>((set, get) => {
  let onLobbySession: ((session: { id: string; name: string }) => void) | null = null;
  let onLobbyTables: ((tables: LobbyTableRow[]) => void) | null = null;
  let onMatchStart: ((payload: { matchId: string }) => void) | null = null;
  let onMatchEndedLobby: ((payload: { reason?: string }) => void) | null = null;
  let onLobbyResumed: ((payload: { tableId: string; matchId: string | null }) => void) | null = null;
  let onConnect: (() => void) | null = null;
  let onDisconnect: (() => void) | null = null;
  let onConnectError: (() => void) | null = null;

  return {
    connected: false,
    session: null,
    tables: [],
    selectedId: null,
    matchId: null,
    seatedTableId: null,
    status: null,
    connect: () => {
      const s = getSocket();
      if (onConnect)
        s.off("connect", onConnect);
      if (onDisconnect)
        s.off("disconnect", onDisconnect);
      if (onConnectError)
        s.off("connect_error", onConnectError);
      if (onLobbySession)
        s.off("session", onLobbySession);
      if (onLobbyTables)
        s.off("lobby:tables", onLobbyTables);
      if (onMatchStart)
        s.off("match:start", onMatchStart);
      if (onMatchEndedLobby)
        s.off("match:ended", onMatchEndedLobby);
      if (onLobbyResumed)
        s.off("lobby:resumed", onLobbyResumed);

      onConnect = () => set({ connected: true, status: null });
      onDisconnect = () => set({ connected: false, status: "Нет связи с сервером" });
      onConnectError = () =>
        set({ connected: false, status: "Сервер недоступен (порт 3001)" });
      // Do not s.off("session") globally — socket.ts persists bilot_session.
      onLobbySession = session => set({ session });
      onLobbyTables = (tables: LobbyTableRow[]) => {
        set({ tables });
        if (!get().selectedId && tables[0])
          set({ selectedId: tables[0].id });
      };
      onMatchStart = (payload: { matchId: string }) => {
        set({ matchId: payload.matchId, status: null });
      };
      onMatchEndedLobby = (payload: { reason?: string }) => {
        set({
          matchId: null,
          seatedTableId: null,
          status: payload.reason === "opponent_left"
            ? "Соперник покинул стол"
            : "Матч завершён",
        });
        window.dispatchEvent(new Event("belote:balance"));
      };
      onLobbyResumed = (payload: { tableId: string; matchId: string | null }) => {
        set({
          seatedTableId: payload.tableId,
          selectedId: payload.tableId,
          matchId: payload.matchId,
          status: payload.matchId ? null : "Переподключено — ждём соперника",
        });
      };

      s.on("connect", onConnect);
      s.on("disconnect", onDisconnect);
      s.on("connect_error", onConnectError);
      s.on("session", onLobbySession);
      s.on("lobby:tables", onLobbyTables);
      s.on("match:start", onMatchStart);
      s.on("match:ended", onMatchEndedLobby);
      s.on("lobby:resumed", onLobbyResumed);

      if (!s.connected)
        s.connect();
    },
    select: id => set({ selectedId: id }),
    sit: (tableId) => {
      const s = getSocket();
      if (!s.connected) {
        set({ status: "Нет связи — запустите сервер" });
        return;
      }
      set({ status: "Садимся за стол…", selectedId: tableId });
      s.emit("lobby:sit", { tableId }, (res: { error?: string; ok?: boolean }) => {
        if (res?.error) {
          set({ status: errText(res.error) });
          return;
        }
        set({
          seatedTableId: tableId,
          status: "За столом — откройте вторую вкладку и нажмите «Играть»",
        });
        window.dispatchEvent(new Event("belote:balance"));
      });
    },
    playBot: () => {
      const s = getSocket();
      if (!s.connected) {
        set({ status: "Нет связи — запустите сервер" });
        return;
      }
      set({ status: "Готовим стол с ботом…" });
      s.emit(
        "lobby:practice",
        (res: { error?: string; ok?: boolean; tableId?: string }) => {
          if (res?.error) {
            set({ status: errText(res.error) });
            return;
          }
          set({
            seatedTableId: res.tableId ?? null,
            status: null,
          });
        },
      );
    },
    leave: (tableId) => {
      const s = getSocket();
      if (!s.connected) {
        set({ status: "Нет связи — запустите сервер" });
        return;
      }
      set({ status: "Встаём со стола…" });
      s.emit("lobby:leave", { tableId }, (res: { error?: string; ok?: boolean }) => {
        if (res?.error) {
          set({ status: errText(res.error) });
          return;
        }
        set({ matchId: null, seatedTableId: null, status: null });
        window.dispatchEvent(new Event("belote:balance"));
      });
    },
    setName: (name) => {
      sessionStorage.setItem("bilot_name", name);
      const s = getSocket();
      s.auth = {
        ...(typeof s.auth === "object" && s.auth ? s.auth : {}),
        name,
        sessionId: sessionStorage.getItem("bilot_session") ?? undefined,
      };
      s.emit("session:name", { name }, (res: { session?: { id: string; name: string } }) => {
        if (res?.session)
          set({ session: res.session });
      });
    },
    clearMatchNav: () => set({ matchId: null, seatedTableId: null }),
  };
});
