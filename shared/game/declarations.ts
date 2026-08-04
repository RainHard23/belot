import type { Card, Declaration, DeclarationKind, Rank, Seat, Suit } from "./types";
import { sequenceOrder } from "./ranks";
import { RANKS, SUITS } from "./types";

function cardKey(c: Card): string {
  return c.id;
}

function hasBella(hand: Card[], trump: Suit): Card[] | null {
  const q = hand.find(c => c.suit === trump && c.rank === "Q");
  const k = hand.find(c => c.suit === trump && c.rank === "K");
  if (q && k)
    return [q, k];
  return null;
}

function suitRun(hand: Card[], suit: Suit): Rank[] {
  return RANKS.filter(r => hand.some(c => c.suit === suit && c.rank === r));
}

function findSequences(
  hand: Card[],
  seat: Seat,
): Declaration[] {
  const out: Declaration[] = [];
  for (const suit of SUITS) {
    const ranks = suitRun(hand, suit);
    if (ranks.length < 3)
      continue;
    const sorted = [...ranks].sort((a, b) => sequenceOrder(a) - sequenceOrder(b));
    // find contiguous runs by sequence order
    let run: Rank[] = [sorted[0]!];
    const flush = () => {
      if (run.length >= 3) {
        const cards = run.map(
          r => hand.find(c => c.suit === suit && c.rank === r)!,
        );
        let kind: DeclarationKind;
        let rawPoints: number;
        let gameBonus: number;
        if (run.length >= 6) {
          kind = "six_plain";
          rawPoints = 15;
          gameBonus = 15;
        }
        else if (run.length >= 5) {
          kind = "hundred_seq";
          rawPoints = 10;
          gameBonus = 10;
        }
        else if (run.length >= 4) {
          kind = "fifty";
          rawPoints = 5;
          gameBonus = 5;
        }
        else {
          kind = "tierce";
          rawPoints = 2;
          gameBonus = 2;
        }
        out.push({
          id: `${seat}_${kind}_${suit}_${run.join("")}`,
          seat,
          kind,
          suit,
          ranks: [...run],
          rawPoints,
          gameBonus,
          cards,
        });
      }
    };
    for (let i = 1; i < sorted.length; i++) {
      if (sequenceOrder(sorted[i]!) === sequenceOrder(run[run.length - 1]!) + 1) {
        run.push(sorted[i]!);
      }
      else {
        flush();
        run = [sorted[i]!];
      }
    }
    flush();
  }
  return out;
}

function findFourOfKind(hand: Card[], seat: Seat): Declaration[] {
  const out: Declaration[] = [];
  const configs: { rank: Rank; kind: DeclarationKind; raw: number; bonus: number }[] = [
    { rank: "J", kind: "four_jacks", raw: 20, bonus: 20 },
    { rank: "9", kind: "four_nines", raw: 14, bonus: 14 },
    { rank: "A", kind: "four_aces", raw: 11, bonus: 11 },
    { rank: "10", kind: "hundred_four", raw: 10, bonus: 10 },
    { rank: "K", kind: "hundred_four", raw: 10, bonus: 10 },
    { rank: "Q", kind: "hundred_four", raw: 10, bonus: 10 },
  ];
  for (const cfg of configs) {
    const cards = hand.filter(c => c.rank === cfg.rank);
    if (cards.length === 4) {
      out.push({
        id: `${seat}_${cfg.kind}_${cfg.rank}`,
        seat,
        kind: cfg.kind,
        ranks: [cfg.rank],
        rawPoints: cfg.raw,
        gameBonus: cfg.bonus,
        cards,
      });
    }
  }
  return out;
}

const FOUR_PRIORITY: Record<string, number> = {
  four_jacks: 6,
  four_nines: 5,
  four_aces: 4,
  hundred_four_A: 3,
  hundred_four_K: 2,
  hundred_four_Q: 1,
  hundred_four_10: 0,
};

function fourKey(d: Declaration): string {
  if (d.kind === "hundred_four")
    return `hundred_four_${d.ranks?.[0]}`;
  return d.kind;
}

function seqHigh(d: Declaration): number {
  const ranks = d.ranks ?? [];
  return Math.max(...ranks.map(sequenceOrder), -1);
}

function cardsOverlap(a: Declaration, b: Declaration): boolean {
  const set = new Set(a.cards.map(cardKey));
  return b.cards.some(c => set.has(cardKey(c)));
}

/**
 * Resolve declarations for both hands.
 * Bella always counts for its owner.
 * Equal sequences cancel; trump suit preferred.
 * Non-overlapping decls both count; overlapping — prefer higher.
 */
export function resolveDeclarations(
  hands: Record<Seat, Card[]>,
  trump: Suit,
): { accepted: Declaration[]; bella: Declaration[] } {
  const candidates: Declaration[] = [];
  const bellas: Declaration[] = [];

  for (const seat of ["p0", "p1"] as Seat[]) {
    const bellaCards = hasBella(hands[seat], trump);
    if (bellaCards) {
      // Check belny tierce J-K or Q-A trump
      const seqs = findSequences(hands[seat], seat);
      const belny = seqs.find(
        s =>
          s.suit === trump
          && s.kind === "tierce"
          && ((s.ranks?.includes("J") && s.ranks?.includes("Q") && s.ranks?.includes("K"))
            || (s.ranks?.includes("Q") && s.ranks?.includes("K") && s.ranks?.includes("A"))),
      );
      if (belny) {
        bellas.push({
          ...belny,
          kind: "bella",
          rawPoints: 4,
          gameBonus: 4,
          id: `${seat}_belny`,
        });
      }
      else {
        bellas.push({
          id: `${seat}_bella`,
          seat,
          kind: "bella",
          suit: trump,
          ranks: ["Q", "K"],
          rawPoints: 2,
          gameBonus: 2,
          cards: bellaCards,
        });
      }
    }

    // Bilot: 6 trump in a row 9-A
    const trumpRanks = suitRun(hands[seat], trump);
    if (
      trumpRanks.length === 6
      && RANKS.every(r => trumpRanks.includes(r))
    ) {
      candidates.push({
        id: `${seat}_bilot`,
        seat,
        kind: "bilot",
        suit: trump,
        ranks: [...RANKS],
        rawPoints: 15,
        gameBonus: 15,
        cards: hands[seat].filter(c => c.suit === trump),
      });
    }
    else {
      candidates.push(...findSequences(hands[seat], seat).filter(s => s.suit !== trump || s.kind !== "tierce" || !bellas.some(b => b.seat === seat && b.kind === "bella" && b.rawPoints === 4)));
      // also non-trump / other sequences
      candidates.push(
        ...findSequences(hands[seat], seat).filter(
          s => !(s.suit === trump && s.kind === "six_plain"),
        ),
      );
    }
    candidates.push(...findFourOfKind(hands[seat], seat));
  }

  // Deduplicate candidates by id
  const uniq = new Map<string, Declaration>();
  for (const c of candidates) uniq.set(c.id, c);
  let list = [...uniq.values()].filter(d => d.kind !== "bella");

  // Mark six trump as bilot already handled; upgrade six_plain on trump
  list = list.map((d) => {
    if (d.kind === "six_plain" && d.suit === trump) {
      return { ...d, kind: "bilot" as const, id: `${d.seat}_bilot` };
    }
    return d;
  });

  // Compare fours between players — higher wins, equal cancel
  const fours = list.filter(d =>
    ["four_jacks", "four_nines", "four_aces", "hundred_four"].includes(d.kind),
  );
  const seqs = list.filter(d =>
    ["tierce", "fifty", "hundred_seq", "six_plain", "bilot"].includes(d.kind),
  );
  const other = list.filter(d => !fours.includes(d) && !seqs.includes(d));

  const acceptedFours = resolveOpposed(
    fours,
    (a, b) => (FOUR_PRIORITY[fourKey(a)] ?? 0) - (FOUR_PRIORITY[fourKey(b)] ?? 0),
  );
  const acceptedSeqs = resolveOpposed(seqs, (a, b) => {
    const lenDiff = (b.ranks?.length ?? 0) - (a.ranks?.length ?? 0);
    if (lenDiff !== 0)
      return -lenDiff;
    const highDiff = seqHigh(b) - seqHigh(a);
    if (highDiff !== 0)
      return -highDiff;
    if (a.suit === trump && b.suit !== trump)
      return 1;
    if (b.suit === trump && a.suit !== trump)
      return -1;
    return 0;
  });

  let accepted = [...acceptedFours, ...acceptedSeqs, ...other];

  // Remove overlapping within same seat — keep higher value
  accepted = dropOverlaps(accepted);
  // Bella always added
  return { accepted: [...accepted, ...bellas], bella: bellas };
}

function resolveOpposed(
  decls: Declaration[],
  cmp: (a: Declaration, b: Declaration) => number,
): Declaration[] {
  const p0 = decls.filter(d => d.seat === "p0");
  const p1 = decls.filter(d => d.seat === "p1");
  if (p0.length === 0)
    return p1;
  if (p1.length === 0)
    return p0;

  // Best of each side
  const best0 = p0.reduce((a, b) => (cmp(a, b) >= 0 ? a : b));
  const best1 = p1.reduce((a, b) => (cmp(a, b) >= 0 ? a : b));
  const c = cmp(best0, best1);
  if (c > 0)
    return p0;
  if (c < 0)
    return p1;
  return []; // equal — neither
}

function dropOverlaps(decls: Declaration[]): Declaration[] {
  const bySeat: Record<Seat, Declaration[]> = { p0: [], p1: [] };
  for (const d of decls) bySeat[d.seat].push(d);

  const result: Declaration[] = [];
  for (const seat of ["p0", "p1"] as Seat[]) {
    const sorted = [...bySeat[seat]].sort(
      (a, b) => b.rawPoints - a.rawPoints || b.cards.length - a.cards.length,
    );
    const kept: Declaration[] = [];
    for (const d of sorted) {
      if (kept.some(k => cardsOverlap(k, d)))
        continue;
      kept.push(d);
    }
    result.push(...kept);
  }
  return result;
}
