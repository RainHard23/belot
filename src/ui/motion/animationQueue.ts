import { useSettingsStore } from "@/store/settingsStore";

type Job = () => Promise<void> | void;

/** Serializes visual events so WS state jumps don't skip animations */
export class AnimationQueue {
  private chain: Promise<void> = Promise.resolve();
  private _busy = false;
  private _generation = 0;

  get busy() {
    return this._busy;
  }

  /** Drop pending work (e.g. leave table / snap reconnect). */
  reset() {
    this._generation += 1;
    this._busy = false;
    this.chain = Promise.resolve();
  }

  /** Bump generation so in-flight scripts stop committing after await. */
  generation() {
    return this._generation;
  }

  enqueue(job: Job, label?: string) {
    const gen = this._generation;
    this.chain = this.chain.then(async () => {
      if (gen !== this._generation)
        return;
      this._busy = true;
      try {
        await job();
      }
      catch (e) {
        console.error("animation job failed", label, e);
      }
      finally {
        if (gen === this._generation)
          this._busy = false;
      }
    });
    return this.chain;
  }

  wait(ms: number) {
    return this.enqueue(
      () => new Promise(r => setTimeout(r, ms)),
      `wait:${ms}`,
    );
  }
}

export const matchAnimQueue = new AnimationQueue();

function reducedMotion() {
  const override = useSettingsStore.getState().reducedMotionOverride;
  if (override === "on")
    return true;
  if (override === "off")
    return false;
  return (
    typeof window !== "undefined"
    && typeof window.matchMedia === "function"
    && window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/** Respects prefers-reduced-motion: collapses scripted delays to ~0. */
export function sleep(ms: number) {
  const delay = reducedMotion() ? 0 : ms;
  return new Promise<void>(r => setTimeout(r, delay));
}
