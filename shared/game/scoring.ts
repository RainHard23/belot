import type { Declaration, HandScore, MatchScore, Seat } from "./types";
import { toPoints } from "./points";
import { OTHER_SEAT } from "./types";

export function scoreHand(input: {
  taker: Seat;
  cardPoints: Record<Seat, number>;
  kittyPoints: number; // full kitty goes into total pool; typically added to last trick winner or split per rules — spec: «6 карт в остатке считаются при подсчете»
  kittyTo: Seat; // who gets kitty card points (last trick winner conventionally)
  declarations: Declaration[];
  tricksTaken: Record<Seat, number>;
  match: MatchScore;
}): {
  hand: Record<Seat, HandScore>;
  match: MatchScore;
  bilotWin?: Seat;
} {
  const { taker, cardPoints, kittyPoints, kittyTo, declarations, tricksTaken, match }
    = input;
  const opp = OTHER_SEAT[taker];

  // Annul declarations if no tricks (except bella goes to opponent)
  const annulled: Declaration[] = [];
  const active: Declaration[] = [];
  for (const d of declarations) {
    if (d.kind === "bella") {
      if (tricksTaken[d.seat] === 0) {
        // bella points go to opponent
        active.push({ ...d, seat: OTHER_SEAT[d.seat] });
        annulled.push(d);
      }
      else {
        active.push(d);
      }
    }
    else if (tricksTaken[d.seat] === 0) {
      annulled.push(d);
    }
    else {
      active.push(d);
    }
  }

  // Bilot: if declared and opponent has 0 tricks — instant win for declarer
  const bilot = active.find(d => d.kind === "bilot");
  if (bilot && tricksTaken[OTHER_SEAT[bilot.seat]] === 0) {
    return {
      hand: {
        p0: emptyHand(),
        p1: emptyHand(),
      },
      match: {
        ...match,
        [bilot.seat]: match[bilot.seat] + 33,
      },
      bilotWin: bilot.seat,
    };
  }

  const declPts: Record<Seat, number> = { p0: 0, p1: 0 };
  for (const d of active) {
    declPts[d.seat] += d.rawPoints;
  }

  const raw: Record<Seat, number> = {
    p0:
      cardPoints.p0
      + declPts.p0
      + (kittyTo === "p0" ? kittyPoints : 0),
    p1:
      cardPoints.p1
      + declPts.p1
      + (kittyTo === "p1" ? kittyPoints : 0),
  };

  // Compare card points + decls without kitty for contract
  const takerScore = cardPoints[taker] + declPts[taker];
  const oppScore = cardPoints[opp] + declPts[opp];

  const bolts = { ...match.bolts };
  const totals = { p0: match.p0, p1: match.p1 };
  const finalRaw = { ...raw };

  const failed = takerScore < oppScore;
  if (failed) {
    // All taker's ochki (without kitty) go to opponent; taker gets bolt
    finalRaw[opp]
      = cardPoints[taker]
        + cardPoints[opp]
        + declPts[taker]
        + declPts[opp]
        + kittyPoints;
    finalRaw[taker] = 0;
    bolts[taker] += 1;
    if (bolts[taker] >= 3) {
      totals[taker] -= 10;
    }
  }

  // Annul penalty -10 for non-bella annulled
  for (const d of annulled) {
    if (d.kind !== "bella") {
      totals[d.seat] -= 10;
    }
  }

  let pts: Record<Seat, number> = {
    p0: toPoints(finalRaw.p0),
    p1: toPoints(finalRaw.p1),
  };

  // Tie on points → compare raw (подпункты); loser gets bolt, winner takes ochki without kitty
  let tieBoltLoser: Seat | null = null;
  if (pts.p0 === pts.p1 && !failed) {
    if (finalRaw.p0 !== finalRaw.p1) {
      const loser: Seat = finalRaw.p0 < finalRaw.p1 ? "p0" : "p1";
      const winner = OTHER_SEAT[loser];
      // winner takes all without kitty consideration already in raw — transfer loser's non-kitty
      finalRaw[winner]
        = cardPoints.p0 + cardPoints.p1 + declPts.p0 + declPts.p1 + kittyPoints;
      finalRaw[loser] = 0;
      bolts[loser] += 1;
      tieBoltLoser = loser;
      if (bolts[loser] >= 3)
        totals[loser] -= 10;
      pts = {
        p0: toPoints(finalRaw.p0),
        p1: toPoints(finalRaw.p1),
      };
    }
  }

  totals.p0 += pts.p0;
  totals.p1 += pts.p1;

  return {
    hand: {
      p0: {
        cardPoints: cardPoints.p0,
        declarationPoints: declPts.p0,
        kittyShare: kittyTo === "p0" ? kittyPoints : 0,
        totalRaw: finalRaw.p0,
        points: pts.p0,
        bolt: (failed && taker === "p0") || tieBoltLoser === "p0",
        annulledDeclarations: annulled.filter(d => d.seat === "p0"),
      },
      p1: {
        cardPoints: cardPoints.p1,
        declarationPoints: declPts.p1,
        kittyShare: kittyTo === "p1" ? kittyPoints : 0,
        totalRaw: finalRaw.p1,
        points: pts.p1,
        bolt: (failed && taker === "p1") || tieBoltLoser === "p1",
        annulledDeclarations: annulled.filter(d => d.seat === "p1"),
      },
    },
    match: { p0: totals.p0, p1: totals.p1, bolts },
  };
}

function emptyHand(): HandScore {
  return {
    cardPoints: 0,
    declarationPoints: 0,
    kittyShare: 0,
    totalRaw: 0,
    points: 0,
    bolt: false,
    annulledDeclarations: [],
  };
}

export function createMatchScore(): MatchScore {
  return { p0: 0, p1: 0, bolts: { p0: 0, p1: 0 } };
}
