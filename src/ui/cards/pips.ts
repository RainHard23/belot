/** Percentage-based pip positions within the card body (0-100 x/y). */
export interface PipSlot {
  x: number;
  y: number;
}

/** Classic 9-pip French layout: two symmetric columns of 4 + one centered. */
export const NINE_LAYOUT: PipSlot[] = [
  { x: 26, y: 15 },
  { x: 74, y: 15 },
  { x: 26, y: 38 },
  { x: 74, y: 38 },
  { x: 50, y: 50 },
  { x: 26, y: 62 },
  { x: 74, y: 62 },
  { x: 26, y: 85 },
  { x: 74, y: 85 },
];

/** Classic 10-pip French layout: two columns of 4 + 2 centered near top/bottom. */
export const TEN_LAYOUT: PipSlot[] = [
  { x: 26, y: 13 },
  { x: 74, y: 13 },
  { x: 50, y: 25 },
  { x: 26, y: 38 },
  { x: 74, y: 38 },
  { x: 26, y: 62 },
  { x: 74, y: 62 },
  { x: 50, y: 75 },
  { x: 26, y: 87 },
  { x: 74, y: 87 },
];
