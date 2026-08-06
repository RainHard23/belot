/**
 * Measure vector from an element’s center to `#table-deck-anchor` (or an
 * otboy pile). Used so deal / collect flights start or end on real table
 * geometry instead of hardcoded guess offsets.
 */
export function offsetFromAnchor(
  target: Element | null,
  anchor: Element | null,
): { x: number; y: number } | null {
  if (!target || !anchor)
    return null;
  const t = target.getBoundingClientRect();
  const a = anchor.getBoundingClientRect();
  return {
    x: a.left + a.width / 2 - (t.left + t.width / 2),
    y: a.top + a.height / 2 - (t.top + t.height / 2),
  };
}

export function getDeckAnchor(): HTMLElement | null {
  return document.getElementById("table-deck-anchor");
}

export function getOtboyAnchor(side: "top" | "bottom"): HTMLElement | null {
  return document.querySelector(
    side === "top" ? '[data-otboy="opp"]' : '[data-otboy="you"]',
  );
}
