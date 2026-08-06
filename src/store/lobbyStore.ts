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

export const useLobbyStore = create<LobbyState>((set, get) => ({
  connected: false,
  session: null,
  tables: [],
  selectedId: null,
  matchId: null,
  seatedTableId: null,
  status: null,
  connect: () => {
    const s = getSocket();
    s.off("connect");
    s.off("disconnect");
    s.off("session");
    s.off("lobby:tables");
    s.off("match:start");
    s.off("match:ended");
    s.off("lobby:resumed");
    s.off("connect_error");

    s.on("connect", () => set({ connected: true, status: null }));
    s.on("disconnect", () => set({ connected: false, status: "Нет связи с сервером" }));
    s.on("connect_error", () =>
      set({ connected: false, status: "Сервер недоступен (порт 3001)" }));
    s.on("session", session => set({ session }));
    s.on("lobby:tables", (tables: LobbyTableRow[]) => {
      set({ tables });
      if (!get().selectedId && tables[0])
        set({ selectedId: tables[0].id });
    });
    s.on("match:start", (payload: { matchId: string }) => {
      set({ matchId: payload.matchId, status: null });
    });
    s.on("match:ended", (payload: { reason?: string }) => {
      set({
        matchId: null,
        seatedTableId: null,
        status: payload.reason === "opponent_left"
          ? "Соперник покинул стол"
          : "Матч завершён",
      });
    });
    s.on("lobby:resumed", (payload: { tableId: string; matchId: string | null }) => {
      set({
        seatedTableId: payload.tableId,
        selectedId: payload.tableId,
        matchId: payload.matchId,
        status: payload.matchId ? null : "Переподключено — ждём соперника",
      });
    });

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
    getSocket().emit("lobby:leave", { tableId });
    set({ matchId: null, seatedTableId: null, status: null });
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
  clearMatchNav: () => set({ matchId: null }),
}));
