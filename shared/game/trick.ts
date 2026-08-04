import type { Card, Seat, Suit, TrickPlay } from "./types";
import { cardBeats } from "./ranks";

/**
 * Classic Belote legality for 1×1 (no partner).
 * Must follow suit; if void must trump; must overtrump when able.
 */
export function legalMoves(
  hand: Card[],
  trick: TrickPlay[],
  trump: Suit,
): Card[] {
  if (trick.length === 0)
    return [...hand];

  const led = trick[0]!.card.suit;
  const sameSuit = hand.filter(c => c.suit === led);
  if (sameSuit.length > 0) {
    if (led === trump) {
      const currentWinner = trickWinner(trick, trump);
      const winningCard = trick.find(p => p.seat === currentWinner)!.card;
      const higher = sameSuit.filter(c =>
        cardBeats(c, winningCard, led, trump),
      );
      return higher.length > 0 ? higher : sameSuit;
    }
    return sameSuit;
  }

  const trumps = hand.filter(c => c.suit === trump);
  if (trumps.length === 0)
    return [...hand];

  const winner = trickWinner(trick, trump);
  const winningPlay = trick.find(p => p.seat === winner)!;

  // Opponent is winning whenever current winner is the other seat
  // (in 1×1 the leader of a length-1 trick is always "winning" until we play)
  const youWouldBe = trick.length === 1
    ? trick[0]!.seat
    : winner;
  const opponentWinning = youWouldBe === trick[0]!.seat
    ? trick.length === 1
    : winner !== trick[trick.length - 1]!.seat;

  // Always must trump when void in 1×1 (no partner to protect)
  void opponentWinning;

  if (winningPlay.card.suit === trump) {
    const higher = trumps.filter(c =>
      cardBeats(c, winningPlay.card, led, trump),
    );
    return higher.length > 0 ? higher : trumps;
  }

  return trumps;
}

export function trickWinner(trick: TrickPlay[], trump: Suit): Seat {
  if (trick.length === 0)
    throw new Error("empty trick");
  const led = trick[0]!.card.suit;
  let best = trick[0]!;
  for (let i = 1; i < trick.length; i++) {
    const play = trick[i]!;
    if (cardBeats(play.card, best.card, led, trump))
      best = play;
  }
  return best.seat;
}
