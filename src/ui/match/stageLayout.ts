import * as React from "react";

/**
 * Single source of truth for the match stage's vertical rhythm.
 *
 * Root cause of the old "content slides down" bug: opponent cards / center
 * trick were positioned with `top-[N%]` relative to the *whole* stage box,
 * so any change in HUD or hand-dock height shifted what "12%" meant and
 * pushed things around (and on short viewports, past the bottom edge).
 *
 * Fix: the match grid has five explicit rows (hud / seat / felt / dock /
 * hand). The felt row is the only flexible one (`minmax(0, 1fr)`) and is
 * `position: relative` — every card anchor below is a percentage of THAT
 * row's own box, never the viewport. HUD growing or the dock changing
 * height can no longer move the table.
 */

/**
 * Fixed-height rows, in px, per breakpoint. The felt row eats the rest.
 *
 * `compact` folds the bidding bar into the felt row instead of giving it a
 * row of its own, and shrinks both seat pods. Without it a 1280x800 laptop
 * (~700px of content height once browser chrome is subtracted) spends 500 of
 * those 700px on HUD + pods + bid bar + hand, leaving the felt ~200px and the
 * table a 148px sliver.
 */
export const STAGE_ROWS = {
  mobile: { hud: 44, seat: 0, dock: 0, hand: 128, compact: true },
  tablet: { hud: 52, seat: 0, dock: 0, hand: 152, compact: false },
  desktop: { hud: 56, seat: 0, dock: 0, hand: 168, compact: false },
  /** Short viewports: laptops at 800px tall, and anything with a small window. */
  short: { hud: 48, seat: 0, dock: 0, hand: 136, compact: true },
} as const;

/**
 * `grid-template-rows` for the stage: hud | seatRow(auto) | felt(1fr) |
 * dock(auto) | hand(fixed). Seat/dock rows are `auto` — their content
 * (opponent pod, bidding bar) sizes them, they just don't fight for the
 * remaining space the felt gets.
 */
export function gridTemplateRows(hudPx: number, handPx: number) {
  return `${hudPx}px auto minmax(0, 1fr) auto ${handPx}px`;
}

/** Percentage anchors *within the felt row's own box* (not the viewport). */
export const FELT_ANCHORS = {
  oppCardsTop: "10%",
  trickCenterTop: "48%",
  kittyRight: "6%",
} as const;

function computeRows() {
  if (typeof window === "undefined")
    return STAGE_ROWS.desktop;
  const w = window.innerWidth;
  const h = window.innerHeight;
  // Short-height landscape (phones rotated) — compact the fixed rows hard so
  // the felt keeps most of the vertical space instead of HUD+hand eating it.
  if (h < 480 && w > h) {
    return { hud: 36, seat: 0, dock: 0, hand: 96, compact: true } as const;
  }
  if (w >= 640 && h < 780)
    return STAGE_ROWS.short;
  return w < 640 ? STAGE_ROWS.mobile : w < 1100 ? STAGE_ROWS.tablet : STAGE_ROWS.desktop;
}

/** Reactive hud/hand row heights — recomputed on resize/orientation change. */
export function useStageRows() {
  const [rows, setRows] = React.useState(computeRows);
  React.useEffect(() => {
    const onResize = () => setRows(computeRows());
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onResize);
    };
  }, []);
  return rows;
}
