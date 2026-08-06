/**
 * Every number that decides where the room's horizon sits and how hard the
 * room converges. Changing the look of the environment should mean editing
 * this file, not hunting transforms across components.
 *
 * Why the room and the table don't literally share one CSS `perspective`:
 * the room is full-bleed (it has to be visible behind the HUD and the hand),
 * while the table lives inside the grid's `felt` row (see stageLayout.ts).
 * One shared camera element would have to contain both, which would drag the
 * room into the felt row and leave flat black behind the HUD and the hand.
 * So the two are instead art-directed to agree, and the one invariant that
 * makes that work is: `HORIZON_PCT` stays *above* the table's far rail at
 * every breakpoint, so the table always reads as standing in front of the
 * back wall instead of floating through it. The comment on `HORIZON_PCT`
 * carries the numbers that check out.
 */

/**
 * Wall/floor junction (and the vanishing point), in % of the stage height.
 *
 * Kept at 22 because the table's far rail never gets higher than ~24%:
 * with `--tbl-h` at 74cqh of the felt row and a 30deg tilt, the rail's top
 * lands at 26% (1920x1080), 29% (1280x800), 24% (2560x1440) and 36%
 * (360x640). Raising this number past ~23 makes the table poke through the
 * wall on tall desktop viewports.
 */
export const HORIZON_PCT = 22;

/** Ceiling/back-wall seam, in % of the stage height. */
export const CEILING_PCT = 3;

/**
 * Depth positions (0 = at the back wall, 1 = at the camera) of the panel
 * joints drawn along the side walls. Spaced non-linearly on purpose: in one
 * point perspective, evenly spaced joints bunch up toward the vanishing
 * point, and that bunching is most of what makes a corridor read as deep.
 */
export const SIDE_WALL_JOINTS = [0.14, 0.3, 0.48, 0.68, 0.87] as const;

/**
 * Back wall's horizontal extent, in % of the stage width. Also the floor
 * plane's width: the floor's far edge sits at z=0 (scale 1), so its
 * on-screen width there *is* this number, which is what makes the floor
 * meet the side walls exactly at the back wall's bottom corners.
 *
 * 56% (rather than something narrower) so the room is still wider than the
 * table at the table's own depth — otherwise the rail visibly cuts through
 * the side walls.
 */
export const BACK_WALL_LEFT_PCT = 22;
export const BACK_WALL_RIGHT_PCT = 78;
export const ROOM_WIDTH = `${BACK_WALL_RIGHT_PCT - BACK_WALL_LEFT_PCT}cqw`;

/**
 * Camera focal length, in `cqh` (stage height) rather than px on purpose:
 * with a fixed px perspective the floor plane crosses the camera plane on
 * tall viewports (z > perspective) and the browser clips it into garbage.
 * Expressed relative to the stage, the convergence is identical at 720p and
 * 4K.
 */
export const ROOM_PERSPECTIVE = "140cqh";

/** Floor plane tilt. Rotated about its *top* edge, which is the horizon. */
export const FLOOR_TILT_DEG = 76;

/**
 * How far the floor plane runs. Solved, not guessed: at 76deg with a
 * 140cqh camera, ~100cqh of plane is what it takes to reach the bottom of
 * the stage, so 115 leaves margin without pushing the near edge past the
 * camera (z stays at ~1.12x stage height, well under the 1.4x focal length).
 */
export const FLOOR_LENGTH = "115cqh";

/** The table's own tilt, kept here so the floor and the table agree. */
export const TABLE_TILT_DEG = 30;

/** Clip path of the left wall: screen edge converging on the back wall. */
export const LEFT_WALL_CLIP = `polygon(0% 0%, ${BACK_WALL_LEFT_PCT}% ${CEILING_PCT}%, ${BACK_WALL_LEFT_PCT}% ${HORIZON_PCT}%, 0% 100%)`;
export const RIGHT_WALL_CLIP = `polygon(100% 0%, ${BACK_WALL_RIGHT_PCT}% ${CEILING_PCT}%, ${BACK_WALL_RIGHT_PCT}% ${HORIZON_PCT}%, 100% 100%)`;
/** Ceiling wedge: full width at the camera, back wall's width at the seam. */
export const CEILING_CLIP = `polygon(0% 0%, 100% 0%, ${BACK_WALL_RIGHT_PCT}% ${CEILING_PCT}%, ${BACK_WALL_LEFT_PCT}% ${CEILING_PCT}%)`;
