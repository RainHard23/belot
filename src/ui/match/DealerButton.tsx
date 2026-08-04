/** Brass "dealer" disc — kept for table furniture reuse outside SeatPod if needed. */
export function DealerButton({ className }: { className?: string }) {
  return (
    <div
      className={`flex size-7 items-center justify-center rounded-full border-2 border-[#7a4e10] text-[12px] font-bold text-[#3a2410] shadow-[0_2px_6px_rgba(0,0,0,0.4)] ${className ?? ""}`}
      style={{ background: "linear-gradient(180deg,#ffe1a0,#d9a13d)" }}
      title="Раздающий"
    >
      Р
    </div>
  );
}
