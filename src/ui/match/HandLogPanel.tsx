import type { Seat } from "@shared/game";
import type { AmbientEvent } from "./ambientBus";
import { useEffect, useRef, useState } from "react";
import { ru } from "@/ui/i18n/ru";
import { subscribeAmbient } from "./ambientBus";
import { Panel } from "./controls/Panel";

const MAX_LINES = 40;

interface LogLine {
  id: number;
  text: string;
}

export function HandLogPanel({
  players,
  you,
}: {
  players: { seat: Seat; name: string }[];
  you: Seat;
}) {
  const [lines, setLines] = useState<LogLine[]>([]);
  const idRef = useRef(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    return subscribeAmbient((event: AmbientEvent) => {
      const text = formatLine(event, players, you);
      if (!text)
        return;
      idRef.current += 1;
      const id = idRef.current;
      setLines((prev) => {
        const next = [...prev, { id, text }];
        return next.length > MAX_LINES ? next.slice(-MAX_LINES) : next;
      });
    });
  }, [players, you]);

  // Keep scroll inside this panel only — never scrollIntoView (that walks up
  // to the document and jerks the whole match stage downward on deal/bid).
  useEffect(() => {
    const el = scrollRef.current;
    if (!el)
      return;
    el.scrollTop = el.scrollHeight;
  }, [lines]);

  return (
    <Panel title={ru.logTitle} className="flex min-h-0 max-h-full flex-col">
      <div
        ref={scrollRef}
        className="min-h-0 flex-1 space-y-1.5 overflow-y-auto overscroll-contain pr-1 text-[12px] leading-snug text-white/75"
      >
        {lines.length === 0 && (
          <p className="text-white/35">{ru.logEmpty}</p>
        )}
        {lines.map(line => (
          <p key={line.id} className="border-l border-white/10 pl-2">
            {line.text}
          </p>
        ))}
      </div>
    </Panel>
  );
}

function nameOf(
  players: { seat: Seat; name: string }[],
  seat: Seat | undefined,
  fallback: string,
) {
  if (!seat)
    return fallback;
  return players.find(p => p.seat === seat)?.name ?? fallback;
}

function formatLine(
  event: AmbientEvent,
  players: { seat: Seat; name: string }[],
  you: Seat,
): string | null {
  switch (event.cue) {
    case "deal":
      return ru.logDeal;
    case "bid":
      return ru.logBid;
    case "trump": {
      const suit = event.payload?.suit;
      const who = nameOf(players, event.payload?.seat, ru.taker);
      const sym = suit ? ru.suitSym[suit] : "";
      return `${ru.logTook}: ${who} ${sym}`.trim();
    }
    case "play": {
      const who = nameOf(players, event.payload?.seat, event.payload?.seat === you ? "Вы" : "…");
      return `${ru.logPlay}: ${who}`;
    }
    case "trick": {
      const who = nameOf(players, event.payload?.seat, "…");
      return `${ru.logTrick} → ${who}`;
    }
    case "hand_end":
      return ru.logHandEnd;
    default:
      return null;
  }
}
