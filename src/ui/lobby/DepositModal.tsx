import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/cn";
import { useAuthStore } from "@/store/authStore";
import { ASSETS } from "@/ui/assets";
import { ru } from "@/ui/i18n/ru";

const PRESETS = [10, 25, 50, 100, 500];
const MIN = 1;
const MAX = 10_000;

export function DepositModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [amount, setAmount] = useState(50);
  const depositMock = useAuthStore(s => s.depositMock);
  const busy = useAuthStore(s => s.busy);
  const error = useAuthStore(s => s.error);
  const clearError = useAuthStore(s => s.clearError);
  const balance = useAuthStore(s => s.user?.balance ?? 0);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open)
      return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape")
        onClose();
    };
    window.addEventListener("keydown", onKey);
    panelRef.current?.querySelector<HTMLElement>("input,button")?.focus();
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const clamped = Math.min(MAX, Math.max(MIN, Math.floor(amount) || 0));

  const submit = async () => {
    clearError();
    if (clamped < MIN || clamped > MAX)
      return;
    try {
      await depositMock(clamped);
      onClose();
    }
    catch {
      /* store */
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-center justify-center px-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          role="dialog"
          aria-modal="true"
          aria-label={ru.depositTitle}
        >
          <button
            type="button"
            aria-label="close"
            className="absolute inset-0 bg-black/70 backdrop-blur-[6px]"
            onClick={onClose}
          />
          <motion.div
            ref={panelRef}
            initial={{ opacity: 0, y: 20, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 320, damping: 26 }}
            className="relative z-10 w-full max-w-[420px] overflow-hidden rounded-[22px] border border-white/[0.07] bg-[#1d1d22] shadow-[0_28px_90px_rgba(0,0,0,0.6)]"
          >
            <div
              className="pointer-events-none absolute inset-x-0 top-0 h-28"
              style={{
                background:
                  "radial-gradient(ellipse 80% 100% at 50% 0%, rgba(251,158,29,0.22) 0%, transparent 70%)",
              }}
            />

            <div className="relative p-7">
              <div className="mb-5 flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-[22px] font-bold tracking-tight text-white">
                    {ru.depositTitle}
                  </h2>
                  <p className="mt-1 text-sm text-[#74747c]">{ru.depositHint}</p>
                </div>
                <div className="flex h-11 items-center gap-2 rounded-[14px] border border-[#25252b] bg-[#141418] px-3">
                  <img src={ASSETS.chipGold} alt="" className="size-5" />
                  <span className="tabular-nums text-[15px] font-semibold text-white">
                    {balance}
                  </span>
                </div>
              </div>

              <div className="mb-4 flex flex-wrap gap-2">
                {PRESETS.map(v => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setAmount(v)}
                    className={cn(
                      "h-10 min-w-[58px] rounded-[12px] px-3 text-sm font-semibold transition",
                      amount === v
                        ? "bg-[linear-gradient(180deg,#fea929,#f38300)] text-[#1a1208] shadow-[0_4px_14px_rgba(251,158,29,0.35)]"
                        : "border border-[#25252b] bg-[#141418] text-[#cfcfd4] hover:border-[#fb9e1d]/35",
                    )}
                  >
                    +
                    {v}
                  </button>
                ))}
              </div>

              <label className="mb-4 block">
                <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.08em] text-[#74747c]">
                  Сумма
                </span>
                <Input
                  type="number"
                  min={MIN}
                  max={MAX}
                  value={amount}
                  onChange={e => setAmount(Number(e.target.value) || 0)}
                  className="h-12 rounded-[14px] text-base tabular-nums"
                />
              </label>

              {error && (
                <div className="mb-4 rounded-[12px] border border-rose-500/25 bg-rose-500/[0.08] px-3.5 py-2.5 text-sm text-rose-200">
                  {error}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <Button variant="secondary" size="lg" onClick={onClose}>
                  {ru.cancel}
                </Button>
                <Button
                  variant="default"
                  size="lg"
                  disabled={busy || clamped < MIN || clamped > MAX}
                  onClick={() => void submit()}
                >
                  {busy ? "…" : `${ru.depositConfirm} · ${clamped}`}
                </Button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
