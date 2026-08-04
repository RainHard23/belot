import { CardBack } from "@/ui/cards/CardBack";
import { ru } from "@/ui/i18n/ru";

/** Fan of kitty cards on the felt with a count badge — replaces plain text label. */
export function KittyStack({ count }: { count: number }) {
  if (count === 0)
    return null;

  return (
    <div className="pointer-events-none absolute left-[10%] top-[68%] flex -translate-y-1/2 flex-col items-center gap-1 opacity-90">
      <div className="relative" style={{ width: 30, height: 42 }}>
        {[0, 1, 2].map(i => (
          <div
            key={i}
            className="absolute overflow-hidden rounded-[4px] shadow-[0_3px_8px_rgba(0,0,0,0.5)]"
            style={{
              width: 30,
              height: 42,
              transform: `rotate(${(i - 1) * 9}deg) translateX(${(i - 1) * 4}px)`,
              zIndex: i,
            }}
          >
            <CardBack />
          </div>
        ))}
      </div>
      <span className="rounded-full bg-black/55 px-2 py-0.5 text-[10px] font-semibold text-white/60 backdrop-blur">
        {ru.kitty}
        {" "}
        ·
        {" "}
        {count}
      </span>
    </div>
  );
}
