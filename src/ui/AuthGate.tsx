import type { ReactNode } from "react";
import { useState } from "react";
import { motion } from "motion/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/cn";
import { useAuthStore } from "@/store/authStore";
import { BrandMark } from "@/ui/BrandMark";
import { GateCard, ScreenShell } from "@/ui/ScreenShell";
import { ru } from "@/ui/i18n/ru";

type Mode = "login" | "register";

export function AuthGate() {
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const login = useAuthStore(s => s.login);
  const register = useAuthStore(s => s.register);
  const busy = useAuthStore(s => s.busy);
  const error = useAuthStore(s => s.error);
  const clearError = useAuthStore(s => s.clearError);

  const submit = async () => {
    clearError();
    try {
      if (mode === "login")
        await login(email.trim(), password);
      else
        await register(email.trim(), password, displayName.trim());
    }
    catch {
      /* store */
    }
  };

  const canSubmit
    = email.trim().length > 0
      && password.length >= (mode === "login" ? 1 : 6)
      && (mode === "login" || displayName.trim().length > 0)
      && (mode === "login" || email.trim().includes("@"));

  return (
    <ScreenShell>
      <GateCard>
        <div className="mb-7 flex flex-col items-center">
          <BrandMark size="lg" className="mb-3" />
          <p className="text-center text-[13px] text-[#74747c]">
            Классический белот 1×1 · торг и объявы
          </p>
        </div>

        <div className="mb-6 grid grid-cols-2 gap-1 rounded-[14px] bg-[#141418] p-1">
          <Tab
            active={mode === "login"}
            onClick={() => {
              setMode("login");
              clearError();
            }}
            label={ru.authLogin}
          />
          <Tab
            active={mode === "register"}
            onClick={() => {
              setMode("register");
              clearError();
            }}
            label={ru.authRegister}
          />
        </div>

        <motion.div
          key={mode}
          initial={{ opacity: 0, x: mode === "login" ? -8 : 8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.2 }}
        >
          <h1 className="mb-1 text-[22px] font-bold tracking-tight">
            {mode === "login" ? ru.authLoginTitle : ru.authRegisterTitle}
          </h1>
          <p className="mb-5 text-sm text-[#74747c]">
            {mode === "login" ? ru.authLoginHint : ru.authRegisterHint}
          </p>

          <div className="space-y-3">
            {mode === "register" && (
              <Field label={ru.namePlaceholder}>
                <Input
                  value={displayName}
                  maxLength={24}
                  placeholder={ru.namePlaceholder}
                  onChange={e => setDisplayName(e.target.value)}
                  className="h-12 rounded-[14px]"
                  autoComplete="nickname"
                />
              </Field>
            )}
            <Field label={ru.authEmail}>
              <Input
                type="text"
                value={email}
                placeholder="admin или you@mail.com"
                onChange={e => setEmail(e.target.value)}
                className="h-12 rounded-[14px]"
                autoComplete="username"
              />
            </Field>
            <Field label={ru.authPassword}>
              <Input
                type="password"
                value={password}
                placeholder="••••••••"
                onChange={e => setPassword(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && canSubmit && !busy)
                    void submit();
                }}
                className="h-12 rounded-[14px]"
                autoComplete={mode === "login" ? "current-password" : "new-password"}
              />
            </Field>
          </div>

          {error && (
            <div className="mt-4 rounded-[12px] border border-rose-500/25 bg-rose-500/[0.08] px-3.5 py-2.5 text-sm text-rose-200">
              {error}
            </div>
          )}

          <Button
            variant="play"
            size="lg"
            className="mt-6 w-full"
            disabled={!canSubmit || busy}
            onClick={() => void submit()}
          >
            {busy
              ? "…"
              : mode === "login"
                ? ru.authLogin
                : ru.authRegister}
          </Button>
        </motion.div>
      </GateCard>
    </ScreenShell>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.08em] text-[#74747c]">
        {label}
      </span>
      {children}
    </label>
  );
}

function Tab({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative h-11 rounded-[11px] text-sm font-semibold transition",
        active ? "text-[#1a1208]" : "text-[#74747c] hover:text-[#cfcfd4]",
      )}
    >
      {active && (
        <motion.span
          layoutId="auth-tab"
          className="absolute inset-0 rounded-[11px] bg-[linear-gradient(180deg,#fea929_0%,#f38300_100%)] shadow-[0_4px_16px_rgba(251,158,29,0.35)]"
          transition={{ type: "spring", stiffness: 380, damping: 28 }}
        />
      )}
      <span className="relative z-10">{label}</span>
    </button>
  );
}
