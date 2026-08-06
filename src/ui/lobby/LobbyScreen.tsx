import { Search } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/cn";
import { useAuthStore } from "@/store/authStore";
import { useLobbyStore } from "@/store/lobbyStore";
import { ASSETS, avatarUrl } from "@/ui/assets";
import { ru } from "@/ui/i18n/ru";
import { TableSurface } from "@/ui/match/TableSurface";
import { AppHeader } from "./AppHeader";
import { DepositModal } from "./DepositModal";

const COL
  = "grid-cols-[minmax(140px,1.7fr)_minmax(72px,0.7fr)_minmax(56px,0.55fr)_minmax(64px,0.55fr)_minmax(88px,0.9fr)_118px]";

export function LobbyScreen({
  onEnterMatch,
  onEditName,
  onLogout,
}: {
  onEnterMatch: (matchId: string) => void;
  onEditName?: () => void;
  onLogout?: () => void;
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
  const [clock, setClock] = useState(() => timeNow());
  const [depositOpen, setDepositOpen] = useState(false);

  const balance = useAuthStore(s => s.user?.balance ?? 0);
  const refreshBalance = useAuthStore(s => s.refreshBalance);

  useEffect(() => {
    connect();
  }, [connect]);

  useEffect(() => {
    if (matchId)
      onEnterMatch(matchId);
  }, [matchId, onEnterMatch]);

  useEffect(() => {
    const id = window.setInterval(() => setClock(timeNow()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const onBal = () => void refreshBalance();
    window.addEventListener("belote:balance", onBal);
    return () => window.removeEventListener("belote:balance", onBal);
  }, [refreshBalance]);

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

  const playersOnline = tables.reduce((n, t) => n + t.filled, 0);
  const seats = selected?.seats ?? [null, null];
  const selectedBuyIn = selected?.buyIn ?? (Number.parseInt(selected?.stakes ?? "", 10) || 0);

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-[#121216] font-[Nunito,sans-serif] text-[#f3f3f3]">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 70% 40% at 20% -10%, rgba(251,158,29,0.08) 0%, transparent 50%),"
            + "radial-gradient(ellipse 50% 35% at 90% 10%, rgba(154,44,57,0.08) 0%, transparent 45%),"
            + "linear-gradient(180deg, #18181d 0%, #121216 40%, #0e0e12 100%)",
        }}
      />

      <div className="relative z-10 flex min-h-screen flex-col">
        <AppHeader
          online={connected}
          playerName={session?.name}
          balance={balance}
          onEditName={onEditName}
          onLogout={onLogout}
          onDeposit={() => setDepositOpen(true)}
        />
        <DepositModal open={depositOpen} onClose={() => setDepositOpen(false)} />

        <div className="flex h-[52px] items-center justify-between px-8 lg:px-12">
          <div className="flex items-center gap-3">
            <span className="inline-block h-[18px] w-[3px] rounded-full bg-[#fb9e1d] shadow-[0_0_10px_rgba(251,158,29,0.55)]" />
            <h2 className="text-[17px] font-bold tracking-tight text-white">{ru.cashGames}</h2>
            <span className="hidden text-sm text-[#74747c] sm:inline">
              Белот 1×1 · классический торг
            </span>
          </div>
          <div className="hidden items-center gap-2 text-[12px] text-[#74747c] md:flex">
            <img src={ASSETS.chipGold} alt="" className="size-4 opacity-80" />
            Buy-in → банк → 90% победителю · 10% дом
          </div>
        </div>

        <AnimatePresence>
          {status && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden border-b border-amber-500/20 bg-amber-500/[0.08] px-8 py-2.5 text-sm text-amber-100 lg:px-12"
            >
              {status}
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-hidden px-4 pb-4 sm:px-8 lg:flex-row lg:px-12">
          <section className="flex min-w-0 flex-1 flex-col">
            <div className="mb-3 flex flex-wrap items-center gap-2.5">
              <div className="relative min-w-[200px] max-w-[300px] flex-1">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-[#74747c]" />
                <Input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder={ru.search}
                  className="h-[42px] pl-10"
                />
              </div>
              <FilterChip
                label={ru.hideFull}
                on={hideFull}
                onChange={setHideFull}
                eyeSrc={hideFull ? ASSETS.lobby.eyeOff : ASSETS.lobby.eye}
              />
              <FilterChip
                label={ru.hideEmpty}
                on={hideEmpty}
                onChange={setHideEmpty}
                eyeSrc={hideEmpty ? ASSETS.lobby.eyeOff : ASSETS.lobby.eye}
              />
              <Button
                size="sm"
                variant="secondary"
                title={ru.playBotHint}
                onClick={() => playBot()}
                disabled={!connected || Boolean(seatedTableId)}
                className="h-[42px] rounded-[14px] px-4"
              >
                {ru.playBot}
              </Button>
            </div>

            <div
              className={cn(
                "grid h-9 items-center gap-2 px-5 text-[11px] font-semibold uppercase tracking-[0.06em] text-[#74747c]",
                COL,
              )}
            >
              <span className="flex items-center gap-2">
                {ru.tableName}
                <img src={ASSETS.lobby.eye} alt="" className="h-[11px] w-4 opacity-60" />
              </span>
              <span>{ru.game}</span>
              <span>{ru.type}</span>
              <span>{ru.players}</span>
              <span>{ru.stakes}</span>
              <span />
            </div>

            <div className="flex-1 space-y-1.5 overflow-auto pr-1 [scrollbar-width:thin]">
              {filtered.length === 0 && (
                <div className="mx-1 mt-2 flex flex-col items-center justify-center rounded-[16px] border border-dashed border-[#25252b] bg-[#1a1a1f]/60 px-6 py-14 text-center">
                  <p className="text-sm font-semibold text-[#cfcfd4]">
                    {connected ? "Нет столов по фильтру" : "Сервер недоступен"}
                  </p>
                  <p className="mt-1 text-sm text-[#74747c]">
                    {connected ? "Сбросьте фильтры или подождите…" : "Порт 3001 · docker compose up -d postgres"}
                  </p>
                </div>
              )}
              {filtered.map((t, idx) => {
                const active = selected?.id === t.id;
                const seatedHere = seatedTableId === t.id;
                const canSit = t.filled < 2 && !seatedTableId;
                const buyIn = t.buyIn ?? (Number.parseInt(t.stakes, 10) || 0);
                const canAfford = balance >= buyIn;
                const isLive = Boolean(t.live || t.status === "live" || t.filled >= 2);
                const cell = active ? "text-[#feaa2b]" : "text-[#f3f3f3]";
                const muted = active ? "text-[#feaa2b]" : "text-[#cfcfd4]";

                return (
                  <motion.div
                    key={t.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(idx * 0.02, 0.2) }}
                    onClick={() => select(t.id)}
                    className={cn(
                      "grid h-[72px] w-full cursor-pointer items-center gap-2 rounded-[14px] px-5 text-left text-[15px] transition",
                      COL,
                      active
                        ? "bg-[#fb9e1d]/[0.09] shadow-[inset_0_0_0_1px_#fca120]"
                        : "bg-[#1a1a1f]/40 hover:bg-white/[0.035]",
                      seatedHere && !active && "shadow-[inset_0_0_0_1px_rgba(52,211,153,0.4)]",
                    )}
                  >
                    <span className={cn("flex min-w-0 items-center gap-2 truncate font-semibold", cell)}>
                      <span className="truncate">{t.name}</span>
                      {isLive && !active && (
                        <span className="shrink-0 rounded-md bg-rose-500/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-rose-300">
                          live
                        </span>
                      )}
                      {active && (
                        <img src={ASSETS.lobby.eyeGold} alt="" className="h-[11px] w-4 shrink-0" />
                      )}
                    </span>
                    <span className={cn("truncate", muted)}>{ru.brand}</span>
                    <span className={cn("truncate", muted)}>1×1</span>
                    <span className={cn("truncate", muted)}>{t.players}</span>
                    <span className={cn("flex items-center gap-1.5 truncate tabular-nums", muted)}>
                      <img src={ASSETS.chipGold} alt="" className="size-3.5 opacity-80" />
                      {buyIn}
                    </span>

                    <span className="justify-self-end">
                      {seatedHere
                        ? (
                            <Button
                              size="row"
                              variant="secondary"
                              className="min-w-[110px]"
                              onClick={(e) => {
                                e.stopPropagation();
                                leave(t.id);
                              }}
                            >
                              {ru.leave}
                            </Button>
                          )
                        : canSit
                          ? (
                              <Button
                                size="row"
                                variant={active ? "playSelected" : "play"}
                                className="min-w-[110px]"
                                title={!canAfford ? ru.insufficientFunds : undefined}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (canAfford)
                                    sit(t.id);
                                  else
                                    setDepositOpen(true);
                                }}
                              >
                                {canAfford ? ru.play : "Депозит"}
                              </Button>
                            )
                          : (
                              <span className="inline-flex min-w-[110px] items-center justify-center text-[12px] font-semibold text-[#74747c]">
                                {isLive ? ru.statusLive : ru.full}
                              </span>
                            )}
                    </span>
                  </motion.div>
                );
              })}
            </div>
          </section>

          <aside className="hidden w-[min(100%,360px)] shrink-0 flex-col overflow-hidden rounded-[20px] border border-white/[0.06] bg-[#1d1d22]/90 shadow-[0_16px_50px_rgba(0,0,0,0.35)] backdrop-blur-sm lg:flex">
            <div className="px-4 pt-4">
              <div className="mb-1 flex items-start justify-between gap-2">
                <h3 className="text-[19px] font-bold leading-tight text-white">
                  {selected?.name ?? ru.selectTable}
                </h3>
                {selected && (
                  <span className="shrink-0 rounded-[10px] border border-[#fb9e1d]/25 bg-[#fb9e1d]/10 px-2.5 py-1 text-[12px] font-semibold tabular-nums text-[#feaa2b]">
                    до
                    {" "}
                    {selected.target ?? 501}
                  </span>
                )}
              </div>
              <p className="mb-3 flex items-center gap-1.5 text-[13px] text-[#74747c]">
                <img src={ASSETS.chipGold} alt="" className="size-3.5" />
                Вход
                {" "}
                <span className="font-semibold text-[#cfcfd4]">{selectedBuyIn}</span>
                {" · "}
                банк
                {" "}
                <span className="font-semibold text-[#cfcfd4]">{selectedBuyIn * 2}</span>
              </p>

              <div className="mb-1 grid grid-cols-[1fr_auto] gap-3 px-3 text-[11px] font-semibold uppercase tracking-[0.06em] text-[#74747c]">
                <span>{ru.playerCol}</span>
                <span>{ru.cashCol}</span>
              </div>
              <div className="mb-3 space-y-1">
                {seats.map((seat, i) => (
                  <div
                    key={seat?.sessionId ?? `empty-${i}`}
                    className={cn(
                      "grid grid-cols-[1fr_auto] items-center gap-3 rounded-[12px] px-3 py-2.5 text-[14px]",
                      i % 2 === 0 ? "bg-[#141418]" : "bg-transparent",
                    )}
                  >
                    <span className={cn(
                      "flex items-center gap-2 truncate font-semibold",
                      seat ? "text-white" : "text-[#74747c]",
                    )}
                    >
                      <span className={cn(
                        "size-2 shrink-0 rounded-full",
                        seat ? "bg-emerald-400" : "bg-[#3a3a42]",
                      )}
                      />
                      {seat?.name ?? ru.emptySeat}
                    </span>
                    <span className={cn(
                      "flex items-center gap-1 tabular-nums",
                      seat ? "text-white" : "text-[#74747c]",
                    )}
                    >
                      {seat
                        ? (
                            <>
                              <img src={ASSETS.chipGold} alt="" className="size-3.5 opacity-70" />
                              {selectedBuyIn}
                            </>
                          )
                        : "—"}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div
              data-table-theme="emerald"
              className="relative mx-3 mb-3 min-h-[220px] flex-1 overflow-hidden rounded-[16px] bg-[#0e0e11] ring-1 ring-white/[0.04]"
            >
              <TableSurface />
              <AnimatePresence>
                {seats.map((seat, i) =>
                  seat
                    ? (
                        <motion.div
                          key={seat.sessionId}
                          initial={{ scale: 0, opacity: 0, y: i === 0 ? 24 : -24 }}
                          animate={{ scale: 1, opacity: 1, y: 0 }}
                          exit={{ scale: 0.6, opacity: 0 }}
                          transition={{ type: "spring", stiffness: 340, damping: 18 }}
                          className={cn(
                            "absolute left-1/2 z-10 flex -translate-x-1/2 flex-col items-center gap-1",
                            i === 0 ? "bottom-3" : "top-3",
                          )}
                        >
                          <div className="size-10 overflow-hidden rounded-full border-[2.5px] border-[#fb9e1d] shadow-[0_0_14px_rgba(251,158,29,0.4)]">
                            <img
                              src={i === 0 ? ASSETS.avatarDefault : avatarUrl(seat.name)}
                              alt=""
                              className="h-full w-full object-cover"
                            />
                          </div>
                          <span className="rounded-md bg-black/60 px-2 py-0.5 text-[11px] font-semibold backdrop-blur-sm">
                            {seat.name}
                          </span>
                        </motion.div>
                      )
                    : null,
                )}
              </AnimatePresence>
            </div>

            <div className="grid grid-cols-2 gap-3 px-4 pb-4">
              {seatedTableId === selected?.id
                ? (
                    <Button
                      variant="secondary"
                      size="lg"
                      className="col-span-2"
                      onClick={() => selected && leave(selected.id)}
                    >
                      {ru.leave}
                    </Button>
                  )
                : (
                    <Button
                      variant="play"
                      size="lg"
                      className="col-span-2"
                      disabled={
                        !selected
                        || selected.filled >= 2
                        || Boolean(seatedTableId)
                        || balance < selectedBuyIn
                      }
                      onClick={() => {
                        if (!selected)
                          return;
                        if (balance < selectedBuyIn)
                          setDepositOpen(true);
                        else
                          sit(selected.id);
                      }}
                    >
                      {ru.play}
                    </Button>
                  )}
            </div>
          </aside>
        </div>

        {/* Mobile selected-table actions (aside is desktop-only). */}
        {selected && (
          <div className="flex shrink-0 gap-2 border-t border-white/[0.06] bg-[#16161a]/95 px-4 py-3 lg:hidden">
            {seatedTableId === selected.id
              ? (
                  <Button variant="secondary" size="lg" className="flex-1" onClick={() => leave(selected.id)}>
                    {ru.leave}
                  </Button>
                )
              : (
                  <Button
                    variant="play"
                    size="lg"
                    className="flex-1"
                    disabled={
                      selected.filled >= 2
                      || Boolean(seatedTableId)
                      || balance < selectedBuyIn
                    }
                    onClick={() => {
                      if (balance < selectedBuyIn)
                        setDepositOpen(true);
                      else
                        sit(selected.id);
                    }}
                  >
                    {ru.play}
                    {" · "}
                    {selectedBuyIn}
                  </Button>
                )}
          </div>
        )}

        <footer className="flex h-[48px] shrink-0 items-center justify-between border-t border-white/[0.04] bg-[#0e0e11]/90 px-8 text-[12px] text-[#74747c] backdrop-blur-sm lg:px-12">
          <div className="flex items-center gap-5">
            <img
              src={ASSETS.lobby.signal}
              alt=""
              className={cn("h-3.5 w-[18px]", connected ? "opacity-100" : "opacity-30")}
              title={connected ? ru.online : ru.offline}
            />
            <FooterStat icon={ASSETS.lobby.clock} label={clock} />
            <FooterStat
              icon={ASSETS.lobby.players}
              label={`${playersOnline} ${ru.playersOnline}`}
            />
            <FooterStat
              icon={ASSETS.lobby.tables}
              label={`${tables.length} ${ru.tablesCount}`}
            />
          </div>
          <div className="flex items-center gap-4">
            <span>
              {ru.version}
              {" · "}
              {ru.brand}
            </span>
            <img src={ASSETS.lobby.chat} alt="" className="size-4 opacity-55" />
            <img src={ASSETS.lobby.trophy} alt="" className="size-4 opacity-55" />
          </div>
        </footer>
      </div>
    </div>
  );
}

function FooterStat({ icon, label }: { icon: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <img src={icon} alt="" className="h-3 w-auto opacity-80" />
      <span>{label}</span>
    </span>
  );
}

function FilterChip({
  label,
  on,
  onChange,
  eyeSrc,
}: {
  label: string;
  on: boolean;
  onChange: (v: boolean) => void;
  eyeSrc: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!on)}
      className={cn(
        "flex h-[42px] items-center gap-2 rounded-[14px] border px-3.5 text-sm font-semibold transition",
        on
          ? "border-[#fca120]/55 bg-[#fb9e1d]/12 text-[#feaa2b]"
          : "border-[#25252b] bg-[#1a1a1f]/80 text-[#74747c] hover:text-[#cfcfd4]",
      )}
    >
      <img
        src={on ? ASSETS.lobby.eyeGold : eyeSrc}
        alt=""
        className="h-[11px] w-4"
      />
      {label}
    </button>
  );
}

function timeNow() {
  return new Date().toLocaleTimeString("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
  });
}
