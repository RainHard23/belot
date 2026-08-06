import { BalancePill } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { BrandMark } from "@/ui/BrandMark";
import { ASSETS } from "@/ui/assets";
import { ru } from "@/ui/i18n/ru";

export function AppHeader({
  online,
  playerName,
  balance = 0,
  onEditName,
  onLogout,
  onDeposit,
}: {
  online: boolean;
  playerName?: string;
  balance?: number;
  onEditName?: () => void;
  onLogout?: () => void;
  onDeposit?: () => void;
}) {
  return (
    <header className="relative z-20 flex h-[96px] items-center justify-between border-b border-white/[0.04] bg-[#16161a]/95 px-8 backdrop-blur-md lg:px-12">
      <div className="flex items-center gap-4">
        <BrandMark size="sm" />
        <div className="hidden h-[38px] items-center rounded-[12px] border border-[#25252b] bg-[#1d1d22] px-3 text-[13px] font-semibold text-[#cfcfd4] sm:flex">
          RU
        </div>
      </div>

      <nav className="absolute left-1/2 top-0 flex h-full -translate-x-1/2 items-stretch">
        <div className="relative flex w-[120px] flex-col items-center justify-center bg-gradient-to-b from-[#222228] to-[#1a1a1f]">
          <img
            src={ASSETS.navBelote}
            alt=""
            className="h-[46px] w-[36px] object-contain drop-shadow-[0_4px_12px_rgba(0,0,0,0.45)]"
          />
          <span className="mt-0.5 text-[16px] font-semibold text-white">{ru.brand}</span>
          <div className="absolute bottom-0 left-0 h-[4px] w-full rounded-t-[4px] bg-[linear-gradient(90deg,#f38300_0%,#fea929_50%,#fab854_100%)]" />
        </div>
      </nav>

      <div className="flex items-center gap-2.5">
        <BalancePill amount={balance} />
        {onDeposit && (
          <Button
            variant="default"
            className="h-[42px] rounded-[14px] px-3 sm:px-4"
            onClick={onDeposit}
          >
            <span className="sm:hidden">+</span>
            <span className="hidden sm:inline">
              +
              {" "}
              {ru.deposit}
            </span>
          </Button>
        )}
        <button
          type="button"
          onClick={onEditName}
          className="flex h-[42px] max-w-[160px] items-center gap-2.5 rounded-[14px] border border-[#25252b] bg-[#1d1d22] px-3 text-sm font-semibold text-white transition hover:border-[#fca120]/45"
        >
          <div className="relative size-7 shrink-0 overflow-hidden rounded-full border border-[#fb9e1d]/80">
            <img src={ASSETS.avatarDefault} alt="" className="h-full w-full object-cover" />
            <span
              className={cn(
                "absolute bottom-0 right-0 size-2 rounded-full ring-2 ring-[#1d1d22]",
                online ? "bg-emerald-400" : "bg-rose-400",
              )}
              title={online ? ru.online : ru.offline}
            />
          </div>
          <span className="truncate">{playerName ?? "…"}</span>
        </button>
        {onLogout && (
          <button
            type="button"
            onClick={onLogout}
            className="flex h-[42px] items-center rounded-[14px] border border-[#25252b] bg-[#1d1d22] px-3 text-sm font-semibold text-[#74747c] transition hover:border-rose-500/35 hover:text-rose-300"
          >
            {ru.authLogout}
          </button>
        )}
      </div>
    </header>
  );
}
