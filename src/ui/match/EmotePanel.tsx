import { EMOTE_KINDS } from "@shared/net/protocol";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { ru } from "@/ui/i18n/ru";
import { Panel } from "./controls/Panel";

/**
 * Align with server SlidingWindowLimiter (5 / 10s) — client blocks all
 * buttons for 2s so the 5th click doesn't toast rate_limited.
 */
const CLICK_COOLDOWN_MS = 2_000;

/**
 * Real networked table reactions. Collapsed by default so the rail stays
 * quiet — expand when you want to send an emote.
 */
export function EmotePanel({ onSend }: { onSend: (kind: typeof EMOTE_KINDS[number]) => void }) {
  const [open, setOpen] = useState(false);
  const [cooling, setCooling] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timerRef.current)
      clearTimeout(timerRef.current);
  }, []);

  const send = (kind: typeof EMOTE_KINDS[number]) => {
    if (cooling)
      return;
    onSend(kind);
    setCooling(true);
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      setCooling(false);
    }, CLICK_COOLDOWN_MS);
  };

  return (
    <Panel className="gap-0 p-0">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left"
      >
        <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--muted)]">
          {ru.chatTitle}
        </span>
        {open
          ? <ChevronUp size={14} className="text-white/50" />
          : <ChevronDown size={14} className="text-white/50" />}
      </button>
      {open && (
        <div className="flex flex-wrap gap-1.5 border-t border-white/[0.06] px-3 pb-3 pt-2">
          {EMOTE_KINDS.map(emoji => (
            <button
              key={emoji}
              type="button"
              onClick={() => send(emoji)}
              disabled={cooling}
              className={cn(
                "size-9 rounded-[10px] border border-white/[0.08] bg-white/[0.04] text-lg transition",
                "hover:border-[var(--accent)]/50 hover:bg-white/[0.08]",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-ring)]",
                "disabled:opacity-30",
              )}
            >
              {emoji}
            </button>
          ))}
        </div>
      )}
    </Panel>
  );
}
