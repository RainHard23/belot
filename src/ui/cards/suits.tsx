import type { Suit } from "@shared/game";
import { SUIT_COLOR } from "./suitColors";

/** Raw path/group for a suit pip, sized to a 24x24 box, fill via currentColor or explicit fill on parent. */
export function SuitPath({ suit }: { suit: Suit }) {
  switch (suit) {
    case "hearts":
      return (
        <path d="M12 21S4 16.562 4 9.889C4 6.7 6.239 4.5 9 4.5c1.54 0 2.588.755 3 1.5.412-.745 1.46-1.5 3-1.5 2.761 0 5 2.2 5 5.389C20 16.562 12 21 12 21Z" />
      );
    case "diamonds":
      return <path d="M12 2 20 12 12 22 4 12Z" />;
    case "spades":
      return (
        <path d="M12 2C12 2 5 9 5 13.5 5 16.538 7.239 18.5 9.7 18.5c.92 0 1.74-.33 2.3-.84-.4 1.96-2 3.34-4 3.34h8c-2 0-3.6-1.38-4-3.34.56.51 1.38.84 2.3.84 2.461 0 4.7-1.962 4.7-4.5C19 9 12 2 12 2Z" />
      );
    case "clubs":
      return (
        <g>
          <circle cx="12" cy="8.2" r="4" />
          <circle cx="7.8" cy="13" r="4" />
          <circle cx="16.2" cy="13" r="4" />
          <path d="M10 15h4l1.6 6H8.4Z" />
        </g>
      );
    default:
      return null;
  }
}

/** Standalone icon — use in HUD/badges where a full <svg> wrapper is needed. */
export function SuitIcon({
  suit,
  className,
  title,
}: {
  suit: Suit;
  className?: string;
  title?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill={SUIT_COLOR[suit]}
      aria-hidden={!title}
      role={title ? "img" : undefined}
    >
      {title && <title>{title}</title>}
      <SuitPath suit={suit} />
    </svg>
  );
}
