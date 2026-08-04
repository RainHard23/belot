import type { PlayerView, Seat } from "@shared/game";
import { Button } from "@/components/ui/button";
import { ru } from "@/ui/i18n/ru";

export function HandEndPanel({
  view,
  players,
  onNext,
  onLeave,
}: {
  view: PlayerView;
  players: { seat: Seat; name: string }[];
  onNext: () => void;
  onLeave: () => void;
}) {
  const summary = view.lastHandSummary;
  const over = view.matchOver;
  const nameOf = (seat: Seat) =>
    players.find(p => p.seat === seat)?.name ?? seat;

  if (over) {
    const youWon = over.winner === view.you;
    return (
      <div className="flex max-w-lg flex-col items-center gap-3 rounded-[16px] border border-[#fb9e1d]/40 bg-[#1d1d22] px-6 py-5 text-center shadow-xl">
        <div className="text-lg font-bold text-[#fb9e1d]">{ru.matchOver}</div>
        <div className="text-2xl font-extrabold text-white">
          {youWon ? ru.youWin : ru.youLose}
        </div>
        <p className="text-sm text-[#74747c]">
          {over.reason === "bolts" ? "Победа по болтам (3)" : `До ${view.target} очков`}
          {" · "}
          {view.matchScore.p0}
          :
          {view.matchScore.p1}
        </p>
        <Button variant="play" size="lg" onClick={onLeave}>{ru.backLobby}</Button>
      </div>
    );
  }

  const hand = summary?.hand;
  const bilot = summary?.bilotWin;

  return (
    <div className="flex max-w-lg flex-col gap-3 rounded-[16px] border border-[#25252b] bg-[#1d1d22]/95 px-5 py-4 shadow-xl backdrop-blur">
      <div className="text-center text-sm font-semibold text-[#fb9e1d]">{ru.handOver}</div>
      {bilot && (
        <div className="rounded-[10px] bg-[#fb9e1d]/15 px-3 py-2 text-center text-sm font-bold text-[#fb9e1d]">
          Билот!
          {" "}
          {nameOf(bilot)}
        </div>
      )}
      {hand && (
        <div className="grid grid-cols-2 gap-3 text-sm">
          {(["p0", "p1"] as Seat[]).map(seat => (
            <div
              key={seat}
              className="rounded-[12px] bg-[#19191d] px-3 py-2"
            >
              <div className="mb-1 font-bold text-white">{nameOf(seat)}</div>
              <div className="text-[#74747c]">
                Карты
                {" "}
                <span className="text-white">{hand[seat].cardPoints}</span>
              </div>
              <div className="text-[#74747c]">
                Объявы
                {" "}
                <span className="text-white">{hand[seat].declarationPoints}</span>
              </div>
              <div className="font-semibold text-[#fb9e1d]">
                =
                {" "}
                {hand[seat].points}
                {" "}
                очк.
                {hand[seat].bolt ? " · болт" : ""}
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="text-center text-xs text-[#74747c]">
        Матч
        {" "}
        {view.matchScore.p0}
        :
        {view.matchScore.p1}
        {" · "}
        {ru.bolts}
        {" "}
        {view.matchScore.bolts.p0}
        /
        {view.matchScore.bolts.p1}
        {" · до "}
        {view.target}
      </div>
      <Button variant="play" size="lg" onClick={onNext}>{ru.nextHand}</Button>
    </div>
  );
}
