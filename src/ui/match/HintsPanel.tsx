import type { PlayerView } from "@shared/game";
import { ru } from "@/ui/i18n/ru";
import { Panel } from "./controls/Panel";

export function HintsPanel({ view }: { view: PlayerView }) {
  const hint = phaseHint(view.phase);
  const decls = view.declarations;

  return (
    <Panel title={ru.hintsTitle}>
      <p className="text-[12px] leading-snug text-white/70">{hint}</p>
      <div className="mt-1 border-t border-white/[0.06] pt-2">
        <div className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--muted)]">
          {ru.declsTitle}
        </div>
        {decls.length === 0
          ? <p className="text-[12px] text-white/35">{ru.declsNone}</p>
          : (
              <ul className="space-y-1">
                {decls.map(d => (
                  <li
                    key={`${d.seat}-${d.kind}-${d.gameBonus}`}
                    className="text-[12px] text-white/75"
                  >
                    <span className="font-semibold text-[var(--accent)]">
                      {ru.decls[d.kind] ?? d.kind}
                    </span>
                    {" "}
                    <span className="text-white/40">
                      +
                      {d.gameBonus}
                    </span>
                  </li>
                ))}
              </ul>
            )}
      </div>
    </Panel>
  );
}

function phaseHint(phase: PlayerView["phase"]): string {
  switch (phase) {
    case "bidding1":
      return ru.hintsBidding;
    case "bidding2":
      return ru.hintsBidding2;
    case "playing":
      return ru.hintsPlaying;
    case "handEnd":
      return ru.hintsHandEnd;
    default:
      return ru.hintsWaiting;
  }
}
