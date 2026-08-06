import type { ReactNode } from "react";
import { motion } from "motion/react";

/** Shared atmosphere for auth / name gates — felt-dark casino lobby mood. */
export function ScreenShell({ children }: { children: ReactNode }) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#121216] px-5 font-[Nunito,sans-serif] text-white">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 80% 55% at 50% 0%, rgba(251,158,29,0.12) 0%, transparent 55%),"
            + "radial-gradient(ellipse 70% 50% at 50% 100%, rgba(154,44,57,0.14) 0%, transparent 50%),"
            + "linear-gradient(180deg, #1a1a20 0%, #121216 45%, #0c0c0f 100%)",
        }}
      />
      {/* Soft table silhouette */}
      <div
        className="pointer-events-none absolute left-1/2 top-[58%] h-[42%] w-[min(920px,92vw)] -translate-x-1/2 -translate-y-1/2 rounded-[999px] opacity-[0.18]"
        style={{
          background:
            "radial-gradient(ellipse at 50% 40%, #1f6b45 0%, #0e3a28 55%, transparent 75%)",
          boxShadow: "0 40px 80px rgba(0,0,0,0.5)",
        }}
      />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_40%,transparent_40%,rgba(0,0,0,0.55)_100%)]" />

      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: "spring", stiffness: 280, damping: 24 }}
        className="relative z-10 w-full max-w-[420px]"
      >
        {children}
      </motion.div>
    </div>
  );
}

export function GateCard({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-[22px] border border-white/[0.06] bg-[#1d1d22]/95 p-8 shadow-[0_24px_80px_rgba(0,0,0,0.55)] backdrop-blur-md">
      {children}
    </div>
  );
}
