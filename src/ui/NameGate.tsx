import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BrandMark } from "@/ui/BrandMark";
import { GateCard, ScreenShell } from "@/ui/ScreenShell";
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
    <ScreenShell>
      <GateCard>
        <div className="mb-7 flex flex-col items-center">
          <BrandMark size="lg" className="mb-3" />
        </div>
        <h1 className="mb-1 text-center text-[22px] font-bold tracking-tight">{ru.nameTitle}</h1>
        <p className="mb-6 text-center text-sm text-[#74747c]">
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
          className="mb-5 h-12 rounded-[14px] text-center text-base"
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
      </GateCard>
    </ScreenShell>
  );
}
