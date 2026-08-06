import { Search } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import { SeatChip } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/cn";
import { useLobbyStore } from "@/store/lobbyStore";
import { ASSETS, avatarUrl } from "@/ui/assets";
import { ru } from "@/ui/i18n/ru";
import { TableSurface } from "@/ui/match/TableSurface";
import { AppHeader } from "./AppHeader";

export function LobbyScreen({
  onEnterMatch,
  onEditName,
}: {
  onEnterMatch: (matchId: string) => void;
  onEditName?: () => void;
}) {
  const {
    connect,
    tables,
    selectedId,
    select,
    sit,
    playBot,
    leave,
    matchId,
    connected,
    status,
    seatedTableId,
    session,
  } = useLobbyStore();

  const [search, setSearch] = useState("");
  const [hideFull, setHideFull] = useState(false);
  const [hideEmpty, setHideEmpty] = useState(false);

  useEffect(() => {
    connect();
  }, [connect]);

  useEffect(() => {
    if (matchId)
      onEnterMatch(matchId);
  }, [matchId, onEnterMatch]);

  const filtered = useMemo(() => {
    return tables.filter((t) => {
      if (hideFull && t.filled >= 2)
        return false;
      if (hideEmpty && t.filled === 0)
        return false;
      if (search && !t.name.toLowerCase().includes(search.toLowerCase()))
        return false;
      return true;
    });
  }, [tables, hideFull, hideEmpty, search]);

  const selected
    = filtered.find(t => t.id === selectedId)
      ?? tables.find(t => t.id === selectedId)
      ?? filtered[0]
      ?? tables[0];

  const statusLabel = (t: typeof tables[0]) => {
    if (t.live || t.status === "live")
      return ru.statusLive;
    if (t.status === "waiting" || t.filled === 1)
      return ru.statusWaiting;
    return ru.statusOpen;
  };

  return (
    <div className="flex min-h-screen flex-col bg-[#19191d] font-[Nunito,sans-serif] text-[#f3f3f3]">
      <AppHeader
        online={connected}
        playerName={session?.name}
        onEditName={onEditName}
      />

      <div className="flex h-[56px] items-center justify-between border-b border-white/[0.04] px-12">
        <div className="flex items-center gap-2 text-[16px] font-semibold text-white">
          <span className="inline-block h-4 w-1 rounded-sm bg-[#fb9e1d]" />
          {ru.cashGames}
          <span className="ml-2 text-sm font-normal text-[#74747c]">Белот 1×1 · классический торг</span>
        </div>
      </div>

      {status && (
        <div className="border-b border-amber-500/20 bg-amber-500/10 px-12 py-2 text-sm text-amber-200">
          {status}
        </div>
      )}

      <div className="flex flex-1 gap-5 overflow-hidden px-12 py-5">
        <section className="flex min-w-0 flex-1 flex-col">
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <div className="relative max-w-md flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-x-1/2 text-[#74747c]" />
              <Input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder={ru.search}
                className="pl-10"
              />
            </div>
            <Toggle label={ru.hideFull} on={hideFull} onChange={setHideFull} />
            <Toggle label={ru.hideEmpty} on={hideEmpty} onChange={setHideEmpty} />
            <Button
              size="sm"
              variant="secondary"
              title={ru.playBotHint}
              onClick={() => playBot()}
              disabled={!connected || Boolean(seatedTableId)}
            >
              🤖
              {" "}
              {ru.playBot}
            </Button>
          </div>

          <div className="grid grid-cols-[2.2fr_1fr_1fr_1fr_1.2fr_1.2fr_110px] gap-2 px-4 pb-2 text-[12px] font-semibold uppercase tracking-wider text-[#74747c]">
            <span>{ru.tableName}</span>
            <span>{ru.game}</span>
            <span>{ru.type}</span>
            <span>{ru.players}</span>
            <span>{ru.target}</span>
            <span>{ru.status}</span>
            <span />
          </div>

          <div className="flex-1 space-y-1 overflow-auto pr-1">
            {filtered.length === 0 && (
              <div className="px-4 py-8 text-sm text-[#74747c]">
                {connected ? "Нет столов по фильтру…" : "Сервер :3001 недоступен"}
              </div>
            )}
            {filtered.map((t) => {
              const active = selected?.id === t.id;
              const seatedHere = seatedTableId === t.id;
              const canSit = t.filled < 2 || seatedHere;
              return (
                <div
                  key={t.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => select(t.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      select(t.id);
                    }
                  }}
                  className={cn(
                    "grid w-full cursor-pointer grid-cols-[2.2fr_1fr_1fr_1fr_1.2fr_1.2fr_110px] items-center gap-2 rounded-[14px] px-4 py-3 text-left text-[15px] transition",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#fb9e1d]",
                    active
                      ? "bg-[#fb9e1d]/10 text-[#fb9e1d] ring-1 ring-[#fb9e1d]"
                      : "text-[#f3f3f3] hover:bg-white/[0.03]",
                    seatedHere && "outline outline-1 outline-emerald-500/50",
                  )}
                >
                  <span className="font-semibold">{t.name}</span>
                  <span className={active ? "text-[#fb9e1d]" : "text-[#cfcfd4]"}>{ru.brand}</span>
                  <span className={active ? "text-[#fb9e1d]" : "text-[#cfcfd4]"}>1×1</span>
                  <span className={active ? "text-[#fb9e1d]" : "text-[#cfcfd4]"}>{t.players}</span>
                  <span className={active ? "text-[#fb9e1d]" : "text-[#cfcfd4]"}>{t.stakes}</span>
                  <span className={cn(
                    "text-sm font-semibold",
                    t.status === "live" || t.live ? "text-[#e53935]" : t.filled === 1 ? "text-[#fb9e1d]" : "text-[#74747c]",
                  )}
                  >
                    {statusLabel(t)}
                  </span>
                  <span className="justify-self-end">
                    {seatedHere
                      ? (
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={(e) => {
                              e.stopPropagation();
                              leave(t.id);
                            }}
                          >
                            {ru.leave}
                          </Button>
                        )
                      : (
                          <Button
                            size="sm"
                            variant={canSit ? "play" : "secondary"}
                            disabled={!canSit}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (canSit)
                                sit(t.id);
                            }}
                          >
                            {canSit ? ru.play : ru.full}
                          </Button>
                        )}
                  </span>
                </div>
              );
            })}
          </div>
        </section>

        <aside className="flex w-[340px] shrink-0 flex-col rounded-[18px] bg-[#1d1d22] p-4">
          <h3 className="mb-3 text-[18px] font-bold">
            {selected?.name ?? ru.selectTable}
          </h3>

          <div className="mb-3 space-y-2">
            {(selected?.seats ?? [null, null]).map((seat, i) => (
              <SeatChip
                key={seat?.sessionId ?? `empty-${i}`}
                empty={!seat}
                name={seat?.name}
                avatarSrc={
                  seat
                    ? (i === 0 ? ASSETS.avatarDefault : avatarUrl(seat.name))
                    : undefined
                }
                meta={seat ? selected?.stakes : undefined}
              />
            ))}
          </div>

          <div data-table-theme="emerald" className="relative mb-4 flex min-h-[240px] flex-1 items-center justify-center overflow-hidden rounded-[16px] bg-[#121316]">
            <TableSurface />
            <AnimatePresence>
              {(selected?.seats ?? []).map((seat, i) =>
                seat
                  ? (
                      <motion.div
                        key={seat.sessionId}
                        initial={{ scale: 0, opacity: 0, y: i === 0 ? 24 : -24 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.6, opacity: 0 }}
                        transition={{ type: "spring", stiffness: 340, damping: 18 }}
                        className={cn(
                          "absolute flex flex-col items-center gap-1",
                          i === 0 ? "bottom-3" : "top-3",
                        )}
                      >
                        <div className="size-11 overflow-hidden rounded-full border-[3px] border-[#fb9e1d] shadow-[0_0_16px_rgba(251,158,29,0.4)]">
                          <img
                            src={i === 0 ? ASSETS.avatarDefault : avatarUrl(seat.name)}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        </div>
                        <span className="rounded bg-black/55 px-2 py-0.5 text-[11px] font-semibold">
                          {seat.name}
                        </span>
                      </motion.div>
                    )
                  : null,
              )}
            </AnimatePresence>
          </div>

          <div className="grid grid-cols-1 gap-3">
            {seatedTableId === selected?.id
              ? (
                  <Button variant="secondary" size="lg" onClick={() => selected && leave(selected.id)}>
                    {ru.leave}
                  </Button>
                )
              : (
                  <Button
                    variant="play"
                    size="lg"
                    disabled={!selected || selected.filled >= 2}
                    onClick={() => selected && sit(selected.id)}
                  >
                    {selected?.filled === 1 ? `${ru.play} · ${ru.waitingOpp}` : ru.play}
                  </Button>
                )}
          </div>
        </aside>
      </div>

      <footer className="flex h-[44px] items-center justify-between border-t border-white/[0.04] bg-[#151518] px-12 text-[12px] text-[#74747c]">
        <div className="flex gap-6">
          <span>
            {new Date().toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}
          </span>
          <span>
            {tables.reduce((n, t) => n + t.filled, 0)}
            {" "}
            {ru.playersOnline}
          </span>
          <span>
            {tables.length}
            {" "}
            {ru.tablesCount}
          </span>
        </div>
        <span>
          v1.0 ·
          {ru.brand}
          {" "}
          1×1
        </span>
      </footer>
    </div>
  );
}

function Toggle({
  label,
  on,
  onChange,
}: {
  label: string;
  on: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!on)}
      className="flex items-center gap-2 text-sm text-[#74747c]"
    >
      <span
        className={cn(
          "relative h-5 w-9 rounded-full transition",
          on ? "bg-[#fb9e1d]" : "bg-[#25252b]",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 size-4 rounded-full bg-white transition",
            on ? "left-4" : "left-0.5",
          )}
        />
      </span>
      {label}
    </button>
  );
}
