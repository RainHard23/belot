import type { AmbientCue, AmbientEvent } from "@/ui/match/ambientBus";
import { useSettingsStore } from "@/store/settingsStore";
import { subscribeAmbient } from "@/ui/match/ambientBus";

/**
 * WebAudio sound layer for table events.
 * Only deal + end-of-hand stay audible — everything else was too noisy at
 * a two-player table.
 *
 * Downloaded CC assets (Mixkit) live in `public/sfx/<cue>.mp3`. If a fetch
 * fails we fall back to a tiny synthesized blip via OscillatorNode.
 */
const SFX_FILES: Partial<Record<AmbientCue, string>> = {
  deal: "/sfx/deal.mp3",
  hand_end: "/sfx/hand_end.mp3",
};

/** Synth fallback tone (Hz) per cue, used only if the mp3 fails to load. */
const FALLBACK_TONE: Partial<Record<AmbientCue, number>> = {
  deal: 320,
  hand_end: 260,
};

class SoundBus {
  private ctx: AudioContext | null = null;
  private buffers = new Map<AmbientCue, AudioBuffer | "failed">();
  private unlocked = false;

  /** Must run inside a user-gesture handler (autoplay policy). */
  unlock() {
    if (this.unlocked)
      return;
    this.unlocked = true;
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx)
      return;
    this.ctx = new Ctx();
    if (this.ctx.state === "suspended")
      void this.ctx.resume();
    this.preload();
  }

  private preload() {
    if (!this.ctx)
      return;
    for (const cue of Object.keys(SFX_FILES) as AmbientCue[]) {
      const url = SFX_FILES[cue];
      if (!url)
        continue;
      fetch(url)
        .then(res => res.arrayBuffer())
        .then(buf => this.ctx!.decodeAudioData(buf))
        .then((decoded) => {
          this.buffers.set(cue, decoded);
        })
        .catch(() => {
          this.buffers.set(cue, "failed");
        });
    }
  }

  play(cue: AmbientCue, volume: number) {
    if (!this.ctx || volume <= 0)
      return;
    if (this.ctx.state === "suspended")
      void this.ctx.resume();

    const buffer = this.buffers.get(cue);
    if (buffer && buffer !== "failed") {
      const source = this.ctx.createBufferSource();
      source.buffer = buffer;
      const gain = this.ctx.createGain();
      gain.gain.value = volume;
      source.connect(gain).connect(this.ctx.destination);
      source.start();
      return;
    }
    if (buffer === "failed") {
      this.playFallbackTone(cue, volume);
    }
    // else: still loading — drop this one, the next occurrence will have it
  }

  private playFallbackTone(cue: AmbientCue, volume: number) {
    if (!this.ctx)
      return;
    const freq = FALLBACK_TONE[cue];
    if (!freq)
      return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    const now = this.ctx.currentTime;
    gain.gain.setValueAtTime(volume * 0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
    osc.connect(gain).connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.2);
  }
}

export const soundBus = new SoundBus();

/** Mount once near the root of the match screen. */
export function attachSoundBus() {
  const unlockOnce = () => {
    soundBus.unlock();
    window.removeEventListener("pointerdown", unlockOnce);
    window.removeEventListener("keydown", unlockOnce);
  };
  window.addEventListener("pointerdown", unlockOnce, { once: true });
  window.addEventListener("keydown", unlockOnce, { once: true });

  return subscribeAmbient((event: AmbientEvent) => {
    const { soundOn, soundVolume } = useSettingsStore.getState();
    if (!soundOn)
      return;
    if (!SFX_FILES[event.cue] && !FALLBACK_TONE[event.cue])
      return;
    soundBus.play(event.cue, soundVolume);
  });
}
