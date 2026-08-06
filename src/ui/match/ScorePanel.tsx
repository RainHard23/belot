import type { PlayerView, Seat } from "@shared/game";
import { ru } from "@/ui/i18n/ru";
import { Panel } from "./controls/Panel";

export function ScorePanel({
  view,
  players,
}: {
  view: PlayerView;
  players: { seat: Seat; name: string }[];
}) {
  const p0 = players.find(p => p.seat === "p0")?.name ?? "P0";
  const p1 = players.find(p => p.seat === "p1")?.name ?? "P1";
  const leader = Math.max(view.matchScore.p0, view.matchScore.p1, 1);
  const progressPct = Math.min(100, (leader / view.target) * 100);

  return (
    <Panel title={ru.scoreTitle}>
      <div className="flex items-end justify-center gap-3 py-2">
        <div className="text-center">
          <div className="text-[11px] text-white/45">{p0}</div>
          <div className="text-3xl font-bold tabular-nums text-[var(--accent)]">
            {view.matchScore.p0}
          </div>
        </div>
        <div className="pb-1 text-xl text-white/30">:</div>
        <div className="text-center">
          <div className="text-[11px] text-white/45">{p1}</div>
          <div className="text-3xl font-bold tabular-nums text-[var(--accent)]">
            {view.matchScore.p1}
          </div>
        </div>
      </div>

      {/* Progress toward `target` — the leading score fills the bar. */}
      <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
        <div
          className="h-full rounded-full bg-[var(--accent)] transition-[width]"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      <div className="flex justify-between text-[12px] text-white/55">
        <span>
          {ru.target}
          {": "}
          <span className="font-semibold text-white/80">{view.target}</span>
        </span>
        <span>
          {ru.bolts}
          {": "}
          <span className="font-semibold tabular-nums text-white/80">
            {view.matchScore.bolts.p0}
            /
            {view.matchScore.bolts.p1}
          </span>
        </span>
      </div>
      {view.trump && (
        <div className="rounded-[10px] border border-white/[0.06] bg-white/[0.03] px-2.5 py-1.5 text-[12px]">
          <span className="text-[var(--muted)]">{ru.trump}</span>
          {" "}
          <span className="font-bold text-[var(--accent)]">
            {ru.suitSym[view.trump]}
            {" "}
            {ru.suits[view.trump]}
          </span>
        </div>
      )}
    </Panel>
  );
}
