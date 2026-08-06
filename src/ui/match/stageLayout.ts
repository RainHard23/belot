import * as React from "react";

/**
 * Single source of truth for the match stage's vertical rhythm.
 *
 * Root cause of the old "content slides down" bug: opponent cards / center
 * trick were positioned with `top-[N%]` relative to the *whole* stage box,
 * so any change in HUD or hand-dock height shifted what "12%" meant and
 * pushed things around (and on short viewports, past the bottom edge).
 *
 * Fix: the match grid is hud / felt / hand. Seats and bid sit absolutely
 * inside the felt so the table keeps the leftover height. Card anchors are
 * percentages of the felt box, never the viewport.
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
  /** Hand row fits fan + your seat avatar under the cards. */
  mobile: { hud: 44, seat: 0, dock: 0, hand: 168, compact: true },
  tablet: { hud: 48, seat: 0, dock: 0, hand: 188, compact: false },
  desktop: { hud: 52, seat: 0, dock: 0, hand: 200, compact: false },
  /** Short viewports: laptops at 800px tall, and anything with a small window. */
  short: { hud: 44, seat: 0, dock: 0, hand: 172, compact: true },
} as const;

/**
 * `grid-template-rows` for the stage: hud | felt(1fr) | hand.
 * Seat pods and the bid bar live *inside* the felt (absolute), so the table
 * gets the full leftover height instead of being squeezed by auto rows.
 */
export function gridTemplateRows(hudPx: number, handPx: number) {
  return `${hudPx}px minmax(0, 1fr) ${handPx}px`;
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
    return { hud: 36, seat: 0, dock: 0, hand: 140, compact: true } as const;
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
