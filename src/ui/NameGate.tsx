import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ASSETS } from "@/ui/assets";
import { ru } from "@/ui/i18n/ru";

export function NameGate({
  initial,
  onDone,
}: {
  initial?: string;
  onDone: (name: string) => void;
}) {
  const [name, setName] = useState(initial ?? "");

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#19191d] px-6 font-[Nunito,sans-serif] text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,_#2a2a32_0%,_#19191d_55%,_#0e0e11_100%)]" />
      <div className="relative z-10 w-full max-w-md rounded-[20px] border border-[#25252b] bg-[#1d1d22] p-8 shadow-2xl">
        <div className="mb-6 flex items-center justify-center gap-2">
          <img src={ASSETS.logo} alt="" className="h-8 w-auto" />
          <span className="text-2xl font-bold">
            no
            <span className="mx-0.5 text-[#e53935]">♦</span>
            <span className="font-serif italic">{ru.brand}</span>
          </span>
        </div>
        <h1 className="mb-2 text-center text-xl font-bold">{ru.nameTitle}</h1>
        <p className="mb-5 text-center text-sm text-[#74747c]">
          Имя видно сопернику за столом
        </p>
        <Input
          value={name}
          maxLength={24}
          autoFocus
          placeholder={ru.namePlaceholder}
          onChange={e => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && name.trim())
              onDone(name.trim());
          }}
          className="mb-4 h-12 text-center text-base"
        />
        <Button
          variant="play"
          size="lg"
          className="w-full"
          disabled={!name.trim()}
          onClick={() => onDone(name.trim())}
        >
          {ru.nameContinue}
        </Button>
      </div>
    </div>
  );
}
