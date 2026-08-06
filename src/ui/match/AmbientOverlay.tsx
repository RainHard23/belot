import type { AmbientCue, AmbientEvent } from "./ambientBus";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { useEffectiveReducedMotion } from "@/store/settingsStore";
import {

  subscribeAmbient,
} from "./ambientBus";

const PULSE_MS = 650;
const COOLDOWN_MS = 300;

const CUE_CLASS: Partial<Record<AmbientCue, string>> = {
  bid: "ambient-pulse-bid",
  play: "ambient-pulse-play",
  trick: "ambient-pulse-trick",
  trump: "ambient-pulse-trump",
  deal: "ambient-pulse-deal",
  hand_end: "ambient-pulse-hand-end",
};

/**
 * Full-bleed light pulses driven by ambientBus. One pulse at a time with a
 * short cooldown so stacked anim events don't strobe the room.
 */
export function AmbientOverlay() {
  const [pulseClass, setPulseClass] = useState<string | null>(null);
  const [suitClass, setSuitClass] = useState<string | null>(null);
  const lastAtRef = useRef(0);
  const clearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reducedMotion = useEffectiveReducedMotion();

  useEffect(() => {
    // Fully skip — the global CSS rule only collapses animation *duration* to
    // ~0, but the class would still toggle (and briefly flash) every event.
    if (reducedMotion)
      return;
    return subscribeAmbient((event: AmbientEvent) => {
      const cls = CUE_CLASS[event.cue];
      if (!cls)
        return;
      const now = event.at;
      if (now - lastAtRef.current < COOLDOWN_MS)
        return;
      lastAtRef.current = now;

      if (clearTimerRef.current)
        clearTimeout(clearTimerRef.current);

      setPulseClass(cls);
      setSuitClass(
        event.cue === "trump" && event.payload?.suit
          ? `ambient-trump-${event.payload.suit}`
          : null,
      );

      clearTimerRef.current = setTimeout(() => {
        setPulseClass(null);
        setSuitClass(null);
      }, PULSE_MS);
    });
  }, [reducedMotion]);

  useEffect(() => {
    return () => {
      if (clearTimerRef.current)
        clearTimeout(clearTimerRef.current);
    };
  }, []);

  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none absolute inset-0 z-[1] overflow-hidden",
        pulseClass,
        suitClass,
      )}
    />
  );
}
