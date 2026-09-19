"use client";

/**
 * The countdown ring. Cyan → amber at 10s → red at 5s, with a pulse and an
 * optional tick in the final five seconds.
 *
 * The ring is driven by `remainingMs` (already clock-corrected by the caller),
 * so it animates at 60fps without the server pushing frames.
 */

import { useEffect, useRef } from "react";
import { playTick } from "@/lib/client/sound";

interface Props {
  remainingMs: number;
  totalMs: number;
  muted: boolean;
  /** Hide the digits but keep the ring (used on image-heavy stages). */
  compact?: boolean;
}

const URGENT_AT = 5;
const WARN_AT = 10;

export function CountdownRing({ remainingMs, totalMs, muted, compact }: Props) {
  const seconds = Math.ceil(remainingMs / 1000);
  const fraction = totalMs > 0 ? Math.max(0, Math.min(1, remainingMs / totalMs)) : 0;

  const urgent = seconds <= URGENT_AT && seconds > 0;
  const warn = seconds <= WARN_AT && seconds > URGENT_AT;

  // Tick once per second over the last five, never twice for the same second.
  const lastTicked = useRef<number | null>(null);
  useEffect(() => {
    if (muted || seconds > URGENT_AT || seconds <= 0) {
      if (seconds > URGENT_AT) lastTicked.current = null;
      return;
    }
    if (lastTicked.current === seconds) return;
    lastTicked.current = seconds;
    playTick(seconds <= 2);
  }, [seconds, muted]);

  const stroke = urgent ? "#f43f5e" : warn ? "#ffb020" : "#22d3ee";
  const radius = 42;
  const circumference = 2 * Math.PI * radius;

  return (
    <div
      className={`relative ${compact ? "h-[9vh] w-[9vh]" : "h-[13vh] w-[13vh]"} ${
        urgent ? "animate-pulse-ring" : ""
      }`}
    >
      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
        <circle cx="50" cy="50" r={radius} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="9" />
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke={stroke}
          strokeWidth="9"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - fraction)}
          style={{
            // No CSS transition: the value already updates every frame, and a
            // transition would make it lag behind the true remaining time.
            filter: `drop-shadow(0 0 ${urgent ? 14 : 8}px ${stroke})`,
          }}
        />
      </svg>

      {!compact && (
        <div className="absolute inset-0 flex items-center justify-center">
          <span
            className="font-mono text-[4.4vh] font-black tabular-nums"
            style={{ color: stroke, textShadow: `0 0 24px ${stroke}` }}
          >
            {Math.max(0, seconds)}
          </span>
        </div>
      )}
    </div>
  );
}
