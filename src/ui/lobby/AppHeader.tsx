import { ASSETS } from "@/ui/assets";
import { ru } from "@/ui/i18n/ru";

export function AppHeader({
  online,
  playerName,
  onEditName,
}: {
  online: boolean;
  playerName?: string;
  onEditName?: () => void;
}) {
  return (
    <header className="relative flex h-[108px] items-center justify-between border-b border-white/[0.04] bg-[#19191d] px-12">
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-1.5">
          <img src={ASSETS.logo} alt="" className="h-9 w-auto" />
          <div className="flex items-baseline text-[28px] font-bold leading-none tracking-tight text-[#f3f3f3]">
            <span>no</span>
            <span className="mx-0.5 text-[#e53935]">♦</span>
            <span className="font-serif italic font-semibold">{ru.brand}</span>
          </div>
        </div>
        <div className="flex items-center gap-2 rounded-[12px] border border-[#25252b] bg-[#1d1d22] px-3 py-1.5 text-[14px] font-semibold text-[#f3f3f3]">
          RU
        </div>
      </div>

      <nav className="absolute left-1/2 top-0 flex h-full -translate-x-1/2 items-stretch">
        <div className="relative flex w-[120px] flex-col items-center justify-center bg-[#1f1f23]">
          <img
            src={ASSETS.navBelote}
            alt=""
            className="h-[50px] w-[38px] object-contain"
          />
          <span className="mt-1 text-[18px] font-semibold text-white">{ru.brand}</span>
          <div className="absolute bottom-0 left-0 h-[5px] w-full rounded-t-[5px] bg-gradient-to-r from-[#f38300] via-[#fea929] to-[#fab854]" />
        </div>
      </nav>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onEditName}
          className="flex h-[42px] items-center gap-2 rounded-[14px] border border-[#25252b] bg-[#1d1d22] px-4 text-sm font-semibold text-white hover:border-[#fb9e1d]/50"
        >
          <div className="size-7 overflow-hidden rounded-full border border-[#fb9e1d]/80">
            <img src={ASSETS.avatarDefault} alt="" className="h-full w-full object-cover" />
          </div>
          {playerName ?? "…"}
        </button>
        <span
          className={
            online
              ? "text-xs font-semibold text-emerald-400"
              : "text-xs font-semibold text-rose-400"
          }
          title={online ? ru.online : ru.offline}
        >
          {online ? `● ${ru.online}` : `○ ${ru.offline}`}
        </span>
      </div>
    </header>
  );
}
