import type { Card, MatchAnimEvent, PlayerView, Seat, TrickPlay } from "@shared/game";
import { emitAmbient } from "@/ui/match/ambientBus";
import { matchAnimQueue, sleep } from "./animationQueue";

/** Live visual layer — may lag behind committed server view while anim plays. */
export interface MatchDisplay {
  view: PlayerView | null;
  /** Cards still face-down during deal flip */
  faceDownIds: string[];
  /** Newly dealt rest cards highlight */
  highlightIds: string[];
  /** Opponent backs currently shown (may animate up) */
  oppShown: number;
  /** Cards still in the table stock pile (backs). Shrinks as packets fly out. */
  stockShown: number;
  /** Bid panel visible after face-up + deal */
  bidVisible: boolean;
  /** Trick held on table during collect (server already cleared) */
  heldTrick: TrickPlay[] | null;
  collectTo: "top" | "bottom" | null;
  dealEpoch: number;
  seatEpoch: number;
  animBusy: boolean;
}

export function emptyDisplay(): MatchDisplay {
  return {
    view: null,
    faceDownIds: [],
    highlightIds: [],
    oppShown: 0,
    stockShown: 0,
    bidVisible: false,
    heldTrick: null,
    collectTo: null,
    dealEpoch: 0,
    seatEpoch: 0,
    animBusy: false,
  };
}

type SetDisplay = (patch: Partial<MatchDisplay> | ((d: MatchDisplay) => Partial<MatchDisplay>)) => void;

function winnerSide(you: Seat, winner: Seat): "top" | "bottom" {
  return winner === you ? "bottom" : "top";
}

/**
 * Run a server anim script against display state, then commit final view.
 */
export function playMatchAnimScript(opts: {
  anim: MatchAnimEvent[];
  nextView: PlayerView;
  snap: boolean;
  setDisplay: SetDisplay;
  onBusy?: (busy: boolean) => void;
}) {
  const { anim, nextView, snap, setDisplay, onBusy } = opts;

  if (snap) {
    matchAnimQueue.reset();
    setDisplay({
      view: nextView,
      faceDownIds: [],
      highlightIds: [],
      oppShown: nextView.opponentCount,
      stockShown: nextView.stockCount,
      bidVisible: nextView.phase === "bidding1" || nextView.phase === "bidding2",
      heldTrick: null,
      collectTo: null,
      animBusy: false,
    });
    onBusy?.(false);
    return;
  }

  if (anim.length === 0) {
    matchAnimQueue.enqueue(async () => {
      setDisplay({
        view: nextView,
        faceDownIds: [],
        highlightIds: [],
        oppShown: nextView.opponentCount,
        stockShown: nextView.stockCount,
        bidVisible: nextView.phase === "bidding1" || nextView.phase === "bidding2",
        heldTrick: null,
        collectTo: null,
        animBusy: false,
      });
      onBusy?.(false);
    }, "soft-sync");
    return;
  }

  const gen = matchAnimQueue.generation();
  matchAnimQueue.enqueue(async () => {
    if (gen !== matchAnimQueue.generation())
      return;
    setDisplay({ animBusy: true });
    onBusy?.(true);
    const alive = () => gen === matchAnimQueue.generation();
    try {
    let working: PlayerView = {
      ...nextView,
      // Start from progressive reveal where possible
    };

    for (const event of anim) {
      if (!alive())
        return;
      switch (event.type) {
        case "clear_table": {
          setDisplay(d => ({
            view: working
              ? {
                  ...working,
                  hand: [],
                  opponentCount: 0,
                  faceUp: null,
                  trick: [],
                  declarations: [],
                  stockCount: 24,
                }
              : null,
            faceDownIds: [],
            highlightIds: [],
            oppShown: 0,
            stockShown: 24,
            bidVisible: false,
            heldTrick: null,
            collectTo: null,
            dealEpoch: d.dealEpoch + 1,
            seatEpoch: d.seatEpoch + 1,
          }));
          await sleep(180);
          break;
        }
        case "deal": {
          emitAmbient("deal");
          const ids = event.cards.map(c => c.id);
          if (event.kind === "initial") {
            // Append this 3-card packet onto whatever is already revealed.
            setDisplay((d) => {
              const prevHand = d.view?.hand ?? [];
              const merged = mergeUnique(prevHand, event.cards);
              return {
                view: {
                  ...(d.view ?? nextView),
                  hand: merged,
                  opponentCount: d.oppShown,
                  faceUp: null,
                  trick: [],
                  phase: nextView.phase,
                  stockCount: Math.max(0, d.stockShown - ids.length),
                },
                faceDownIds: [...(d.faceDownIds ?? []), ...ids],
                highlightIds: [],
                bidVisible: false,
                stockShown: Math.max(0, d.stockShown - ids.length),
              };
            });
            await sleep(90);
            for (let i = 0; i < ids.length; i++) {
              setDisplay(d => ({
                faceDownIds: d.faceDownIds.filter(id => id !== ids[i]),
              }));
              await sleep(55);
            }
            await sleep(40);
          }
          else {
            // Rest deal after trump — short second deal from stock.
            const before = working.hand ?? [];
            const merged = mergeUnique(before, event.cards);
            setDisplay(d => ({
              view: {
                ...nextView,
                hand: merged,
                faceUp: null,
              },
              highlightIds: ids,
              faceDownIds: ids,
              bidVisible: false,
              stockShown: Math.max(0, d.stockShown - ids.length),
            }));
            await sleep(100);
            for (let i = 0; i < ids.length; i++) {
              setDisplay({
                faceDownIds: ids.slice(i + 1),
              });
              await sleep(65);
            }
            setDisplay({ faceDownIds: [], highlightIds: [] });
            working = { ...nextView, hand: merged };
            await sleep(120);
          }
          break;
        }
        case "opp_deal": {
          emitAmbient("deal");
          const nCards = event.to - event.from;
          setDisplay(d => ({
            stockShown: Math.max(0, d.stockShown - nCards),
          }));
          const step = event.kind === "initial" ? 50 : 50;
          for (let n = event.from + 1; n <= event.to; n++) {
            setDisplay({ oppShown: n });
            await sleep(step);
          }
          setDisplay({ oppShown: event.to });
          break;
        }
        case "face_up_show": {
          // Face-up mounts on #table-deck-anchor (DeckStack), not table center.
          setDisplay(d => ({
            view: {
              ...nextView,
              hand: nextView.hand.length ? (d.view?.hand ?? nextView.hand) : (working.hand ?? []),
              faceUp: event.card,
              opponentCount: d.oppShown,
              stockCount: Math.max(0, d.stockShown - 1),
            },
            stockShown: Math.max(0, d.stockShown - 1),
          }));
          await sleep(420);
          break;
        }
        case "face_up_hide": {
          emitAmbient("trump", { seat: event.takenBy, suit: nextView.trump ?? undefined });
          setDisplay(d => ({
            view: d.view ? { ...d.view, faceUp: null } : d.view,
          }));
          await sleep(220);
          // Declarations (bella, terz, 50…) are resolved server-side the
          // moment bidding ends, alongside the rest of the deal — this is
          // the first point in the script where they're known.
          if (nextView.declarations.length > 0) {
            emitAmbient("declaration");
          }
          break;
        }
        case "bid_ui": {
          emitAmbient("bid");
          setDisplay({
            bidVisible: true,
            view: {
              ...nextView,
              phase: event.phase,
              faceUp: nextView.faceUp,
            },
          });
          await sleep(160);
          break;
        }
        case "play": {
          emitAmbient("play", { seat: event.seat });
          setDisplay((d) => {
            const existing = (d.view?.trick?.length ? d.view.trick : d.heldTrick) ?? [];
            const trick = nextView.trick.length > 0
              ? nextView.trick
              : [
                  ...existing.filter(p => p.card.id !== event.card.id),
                  { seat: event.seat, card: event.card },
                ];
            return {
              view: {
                ...nextView,
                trick,
                hand: nextView.hand,
                opponentCount: nextView.opponentCount,
              },
              heldTrick: null,
              collectTo: null,
            };
          });
          await sleep(280);
          break;
        }
        case "trick_collect": {
          emitAmbient("trick", {
            seat: event.winner,
            side: winnerSide(nextView.you, event.winner),
          });
          setDisplay({
            heldTrick: event.trick,
            collectTo: null,
            view: {
              ...nextView,
              trick: [],
            },
          });
          await sleep(320);
          setDisplay({
            collectTo: winnerSide(nextView.you, event.winner),
          });
          await sleep(480);
          setDisplay({
            heldTrick: null,
            collectTo: null,
          });
          break;
        }
        case "hand_end": {
          emitAmbient("hand_end");
          setDisplay({ view: nextView, bidVisible: false });
          await sleep(200);
          break;
        }
        case "sync": {
          setDisplay({
            view: nextView,
            oppShown: nextView.opponentCount,
            stockShown: nextView.stockCount,
            faceDownIds: [],
            highlightIds: [],
            bidVisible: nextView.phase === "bidding1" || nextView.phase === "bidding2",
          });
          await sleep(80);
          break;
        }
        default:
          break;
      }
    }

    // Final commit
    if (!alive())
      return;
    setDisplay({
      view: nextView,
      faceDownIds: [],
      highlightIds: [],
      oppShown: nextView.opponentCount,
      stockShown: nextView.stockCount,
      bidVisible: nextView.phase === "bidding1" || nextView.phase === "bidding2",
      heldTrick: null,
      collectTo: null,
      animBusy: false,
    });
    onBusy?.(false);
    }
    finally {
      if (alive()) {
        setDisplay(d => (d.animBusy ? { ...d, animBusy: false, view: d.view ?? nextView } : {}));
        onBusy?.(false);
      }
    }
  }, "match-script");
}

function mergeUnique(a: Card[], b: Card[]): Card[] {
  const ids = new Set(a.map(c => c.id));
  return [...a, ...b.filter(c => !ids.has(c.id))];
}
