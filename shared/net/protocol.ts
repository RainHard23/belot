import type { Seat } from "../game/types";

/**
 * Wire types for socket messages that sit alongside game state (not part of
 * `MatchState`/`PlayerView`) — currently just table emotes. Kept in one file
 * so client and server agree on the exact shape without duplicating it.
 */

/** Closed set of allowed reactions — no free text, so no moderation needed. */
export const EMOTE_KINDS = ["👍", "🔥", "😅", "👏", "😮", "🤝"] as const;
export type EmoteKind = typeof EMOTE_KINDS[number];

export function isEmoteKind(v: unknown): v is EmoteKind {
  return typeof v === "string" && (EMOTE_KINDS as readonly string[]).includes(v);
}

export interface EmotePayload {
  matchId: string;
  seat: Seat;
  kind: EmoteKind;
  ts: number;
}
