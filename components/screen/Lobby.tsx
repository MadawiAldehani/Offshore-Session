"use client";

/**
 * Lobby: the screen the room stares at while people join.
 * Big QR, a typed-out short URL as a fallback, and names landing live.
 */

import { useEffect, useState } from "react";
import type { ScreenView } from "@/lib/types";

interface JoinInfo {
  joinUrl: string;
  host: string;
  loopbackOnly: boolean;
}

export function Lobby({ state }: { state: ScreenView }) {
  const [info, setInfo] = useState<JoinInfo | null>(null);

  useEffect(() => {
    // Ask the server for an address phones can actually reach — the browser's
    // own location may well be "localhost", which is useless on a projector.
    fetch("/api/info")
      .then((r) => r.json())
      .then(setInfo)
      .catch(() => setInfo(null));
  }, []);

  return (
    <div className="flex h-full w-full items-center gap-[4vw] px-[4vw]">
      {/* --- Join panel ----------------------------------------------------- */}
      <div className="flex shrink-0 flex-col items-center">
        <p className="mb-[1.6vh] font-mono text-[2.1vh] uppercase tracking-[0.4em] text-cyan-300/80">
          Scan to join
        </p>

        {/* Sized generously: someone in the back row needs to scan this from
            20-plus metres, and a projector washes out contrast. */}
        <div className="rounded-[2vh] bg-white p-[1.6vh] shadow-[0_0_80px_rgba(34,211,238,0.35)]">
          {info ? (
            <img
              src={`/api/qr?data=${encodeURIComponent(info.joinUrl)}`}
              alt={`QR code linking to ${info.joinUrl}`}
              className="h-[42vh] w-[42vh]"
            />
          ) : (
            <div className="h-[42vh] w-[42vh] animate-pulse rounded-[1vh] bg-slate-200" />
          )}
        </div>

        <p className="mt-[2vh] font-mono text-[3.4vh] font-bold text-amber-bright text-glow-amber">
          {info ? info.host.replace(/^https?:\/\//, "") + "/play" : "…"}
        </p>

        {info?.loopbackOnly && (
          <p className="mt-[1vh] max-w-[34vh] text-center text-[1.4vh] leading-snug text-rose-300/80">
            No network address found — phones on Wi-Fi won’t reach this URL.
            Connect the laptop to the same network as the room.
          </p>
        )}
      </div>

      {/* --- Roster --------------------------------------------------------- */}
      <div className="flex min-w-0 flex-1 flex-col self-stretch py-[6vh]">
        <div className="flex items-baseline gap-[1.4vw]">
          <span className="font-black tabular-nums leading-none text-glow-amber text-amber-bright text-[13vh]">
            {state.playerCount}
          </span>
          <span className="text-[4.4vh] font-bold tracking-tight text-slate-200">
            aboard
          </span>
        </div>
        <p className="mt-[0.5vh] font-mono text-[1.6vh] uppercase tracking-[0.35em] text-cyan-300/60">
          {state.playerCount === 0
            ? "Waiting for the crew"
            : "Crew manifest — live"}
        </p>

        <div className="relative mt-[3vh] flex-1 overflow-hidden">
          <div className="flex flex-wrap content-start gap-[0.9vh]">
            {state.recentPlayers.map((player, index) => (
              <span
                key={player.id}
                className="animate-pop-in rounded-full border border-cyan-400/25 bg-cyan-400/10 px-[1.4vw] py-[0.9vh] text-[2.1vh] font-semibold text-cyan-100"
                style={{
                  // Stagger only the first row or two; beyond that the delay
                  // would be longer than the next state push.
                  animationDelay: `${Math.min(index, 12) * 28}ms`,
                }}
              >
                {player.name}
              </span>
            ))}
          </div>
          {/* Fade the overflow rather than scrolling — this is a projector. */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[10vh] bg-gradient-to-t from-[#02060f] to-transparent" />
        </div>
      </div>
    </div>
  );
}
