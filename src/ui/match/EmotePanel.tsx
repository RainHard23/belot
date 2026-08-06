import { EMOTE_KINDS } from "@shared/net/protocol";
import { useState } from "react";
import { cn } from "@/lib/cn";
import { ru } from "@/ui/i18n/ru";
import { Panel } from "./controls/Panel";

/** Per-button cooldown so a single click can't spam the server limiter. */
const CLICK_COOLDOWN_MS = 1200;

/**
 * Real networked table reactions (server: `match:emote`, both seats join the
 * `match:` room). Replaces the old local-only `ChatStub` — the opponent (or
 * bot) now actually sees what you send, and vice versa.
 */
export function EmotePanel({ onSend }: { onSend: (kind: typeof EMOTE_KINDS[number]) => void }) {
  const [cooling, setCooling] = useState<string | null>(null);

  const send = (kind: typeof EMOTE_KINDS[number]) => {
    if (cooling)
      return;
    onSend(kind);
    setCooling(kind);
    setTimeout(setCooling, CLICK_COOLDOWN_MS, null);
  };

  return (
    <Panel title={ru.chatTitle}>
      <div className="flex flex-wrap gap-1.5">
        {EMOTE_KINDS.map(emoji => (
          <button
            key={emoji}
            type="button"
            onClick={() => send(emoji)}
            disabled={cooling === emoji}
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
    </Panel>
  );
}
