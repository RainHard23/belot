import type { Card, MatchAnimEvent, PlayerView, Seat, TrickPlay } from "@shared/game";
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
        bidVisible: nextView.phase === "bidding1" || nextView.phase === "bidding2",
        heldTrick: null,
        collectTo: null,
        animBusy: false,
      });
      onBusy?.(false);
    }, "soft-sync");
    return;
  }

  onBusy?.(true);
  setDisplay({ animBusy: true });

  matchAnimQueue.enqueue(async () => {
    let working: PlayerView = {
      ...nextView,
      // Start from progressive reveal where possible
    };

    for (const event of anim) {
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
                }
              : null,
            faceDownIds: [],
            highlightIds: [],
            oppShown: 0,
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
          const ids = event.cards.map(c => c.id);
          if (event.kind === "initial") {
            // Show backs first, then flip stagger
            setDisplay(d => ({
              view: {
                ...nextView,
                hand: event.cards,
                opponentCount: d.oppShown,
                faceUp: null,
                trick: [],
                phase: nextView.phase,
              },
              faceDownIds: ids,
              highlightIds: [],
              bidVisible: false,
            }));
            await sleep(120);
            for (let i = 0; i < ids.length; i++) {
              const revealed = ids.slice(0, i + 1);
              setDisplay({
                faceDownIds: ids.filter(id => !revealed.includes(id)),
              });
              await sleep(70);
            }
            setDisplay({ faceDownIds: [] });
            await sleep(80);
          }
          else {
            // +3 / rest — short second deal
            const before = working.hand ?? [];
            const merged = mergeUnique(before, event.cards);
            setDisplay({
              view: {
                ...nextView,
                hand: merged,
                faceUp: null,
              },
              highlightIds: ids,
              faceDownIds: ids,
              bidVisible: false,
            });
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
          const step = event.kind === "initial" ? 55 : 50;
          for (let n = event.from; n <= event.to; n++) {
            setDisplay({ oppShown: n });
            await sleep(step);
          }
          break;
        }
        case "face_up_show": {
          setDisplay({
            view: {
              ...nextView,
              hand: nextView.hand.length ? nextView.hand : (working.hand ?? []),
              faceUp: event.card,
              opponentCount: nextView.opponentCount,
            },
          });
          await sleep(380);
          break;
        }
        case "face_up_hide": {
          setDisplay(d => ({
            view: d.view ? { ...d.view, faceUp: null } : d.view,
          }));
          await sleep(220);
          break;
        }
        case "bid_ui": {
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
          setDisplay({ view: nextView, bidVisible: false });
          await sleep(200);
          break;
        }
        case "sync": {
          setDisplay({
            view: nextView,
            oppShown: nextView.opponentCount,
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
    setDisplay({
      view: nextView,
      faceDownIds: [],
      highlightIds: [],
      oppShown: nextView.opponentCount,
      bidVisible: nextView.phase === "bidding1" || nextView.phase === "bidding2",
      heldTrick: null,
      collectTo: null,
      animBusy: false,
    });
    onBusy?.(false);
  }, "match-script");
}

function mergeUnique(a: Card[], b: Card[]): Card[] {
  const ids = new Set(a.map(c => c.id));
  return [...a, ...b.filter(c => !ids.has(c.id))];
}
