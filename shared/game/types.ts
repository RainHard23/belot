export type Suit = "hearts" | "diamonds" | "spades" | "clubs";
export type Rank = "9" | "10" | "J" | "Q" | "K" | "A";
export type Seat = "p0" | "p1";

export interface Card {
  id: string;
  suit: Suit;
  rank: Rank;
}

export type Phase
  = | "waiting"
    | "deal6"
    | "bidding1"
    | "bidding2"
    | "dealRest"
    | "declare"
    | "playing"
    | "trickEnd"
    | "handEnd";

export type DeclarationKind
  = | "bella"
    | "tierce"
    | "fifty"
    | "hundred_seq"
    | "hundred_four"
    | "four_aces"
    | "four_nines"
    | "four_jacks"
    | "six_plain"
    | "bilot";

export interface Declaration {
  id: string;
  seat: Seat;
  kind: DeclarationKind;
  suit?: Suit;
  ranks?: Rank[];
  rawPoints: number;
  gameBonus: number;
  cards: Card[];
}

export interface TrickPlay {
  seat: Seat;
  card: Card;
}

export interface HandScore {
  cardPoints: number;
  declarationPoints: number;
  kittyShare: number;
  totalRaw: number;
  points: number;
  bolt: boolean;
  annulledDeclarations: Declaration[];
}

export interface MatchScore {
  p0: number;
  p1: number;
  bolts: { p0: number; p1: number };
}

export const SUITS: Suit[] = ["hearts", "diamonds", "spades", "clubs"];
export const RANKS: Rank[] = ["9", "10", "J", "Q", "K", "A"];

export const OTHER_SEAT: Record<Seat, Seat> = {
  p0: "p1",
  p1: "p0",
};
