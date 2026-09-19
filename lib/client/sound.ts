"use client";

/**
 * Countdown tick, synthesised with WebAudio — no audio files to ship.
 *
 * Browsers block audio until the page has had a user gesture, so the projector
 * page shows a one-time "enable sound" button that calls `unlockAudio()`.
 */

let context: AudioContext | null = null;
let unlocked = false;

export function isAudioUnlocked(): boolean {
  return unlocked;
}

/** Call from a click handler. Safe to call repeatedly. */
export async function unlockAudio(): Promise<boolean> {
  try {
    if (!context) {
      const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!Ctor) return false;
      context = new Ctor();
    }
    if (context.state === "suspended") await context.resume();
    unlocked = context.state === "running";
    return unlocked;
  } catch {
    return false;
  }
}

/**
 * A short percussive blip. `urgent` raises the pitch for the final second so
 * the last five seconds audibly accelerate.
 */
export function playTick(urgent = false): void {
  if (!context || !unlocked) return;
  try {
    const now = context.currentTime;
    const oscillator = context.createOscillator();
    const gain = context.createGain();

    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(urgent ? 1180 : 880, now);

    // Fast attack, short decay — a tick, not a beep.
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(urgent ? 0.28 : 0.16, now + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);

    oscillator.connect(gain).connect(context.destination);
    oscillator.start(now);
    oscillator.stop(now + 0.18);
  } catch {
    // Audio is a nice-to-have; never let it break the show.
  }
}

/** Rising two-note sting for the reveal. */
export function playReveal(): void {
  if (!context || !unlocked) return;
  try {
    const now = context.currentTime;
    for (const [index, frequency] of [523.25, 783.99].entries()) {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const start = now + index * 0.1;
      oscillator.type = "triangle";
      oscillator.frequency.setValueAtTime(frequency, start);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.2, start + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.42);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start(start);
      oscillator.stop(start + 0.45);
    }
  } catch {
    // ignored
  }
}
