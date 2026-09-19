"use client";

/**
 * /screen — the projector view.
 *
 * Everything is sized in viewport units so it scales to whatever the projector
 * is running at, and stays readable from the back of an auditorium. There is
 * no scrolling and no interaction: the admin panel drives it.
 */

import { useEffect, useState } from "react";
import { Confetti } from "@/components/screen/Confetti";
import { CountdownRing } from "@/components/screen/CountdownRing";
import { DepthBar } from "@/components/screen/DepthBar";
import { Leaderboard } from "@/components/screen/Leaderboard";
import { Lobby } from "@/components/screen/Lobby";
import { OceanBackdrop } from "@/components/screen/OceanBackdrop";
import {
  BettingStage,
  FinishedStage,
  LockedStage,
  QuestionStage,
} from "@/components/screen/QuestionStage";
import { formatNumber } from "@/lib/client/format";
import { isAudioUnlocked, playReveal, unlockAudio } from "@/lib/client/sound";
import { useCountdown, useNonceEffect, useScreenStream } from "@/lib/client/useGameStream";

export default function ScreenPage() {
  const { data: state, connected, clockOffset } = useScreenStream();
  const { remainingMs } = useCountdown(state?.endsAt ?? null, clockOffset);
  const [audioReady, setAudioReady] = useState(true);

  // Browsers block audio until a gesture. Show a one-time prompt if we need one.
  useEffect(() => {
    setAudioReady(isAudioUnlocked());
  }, []);

  // A sting on each reveal.
  useNonceEffect(state?.revealed ? state.questionIndex + 1 : 0, () => {
    if (!state?.muted) playReveal();
  });

  if (!state) {
    return (
      <main className="relative flex h-dvh items-center justify-center overflow-hidden bg-abyss">
        <OceanBackdrop />
        <p className="relative font-mono text-2xl uppercase tracking-[0.5em] text-cyan-300/60">
          {connected ? "Loading…" : "Connecting…"}
        </p>
      </main>
    );
  }

  const totalMs = questionWindowMs(state);
  const showTimer = state.phase === "question" || state.phase === "betting";
  const showHeader = state.phase !== "lobby";

  return (
    <main className="relative h-dvh w-screen overflow-hidden bg-abyss no-select">
      <OceanBackdrop />
      <Confetti nonce={state.celebrateNonce} />

      {/* Connection warning — silent when healthy. */}
      {!connected && (
        <div className="absolute right-[2vw] top-[2vh] z-40 rounded-full bg-rose-500/90 px-[1.4vw] py-[0.8vh] text-[1.6vh] font-bold">
          Reconnecting…
        </div>
      )}

      {/* One-time audio unlock, only when there is a tick to play. */}
      {!audioReady && !state.muted && (
        <button
          onClick={async () => setAudioReady(await unlockAudio())}
          className="absolute bottom-[2vh] right-[2vw] z-40 rounded-full border border-amber/40 bg-amber/15 px-[1.6vw] py-[1vh] text-[1.6vh] font-semibold text-amber-bright backdrop-blur transition hover:bg-amber/25"
        >
          🔊 Enable sound
        </button>
      )}

      <div className="relative flex h-full w-full flex-col px-[3vw] py-[3vh]">
        {/* --- Header ------------------------------------------------------ */}
        {showHeader && (
          <header className="flex shrink-0 items-center gap-[2.5vw]">
            <div className="min-w-0 flex-1">
              <DepthBar
                depth={state.depth}
                maxDepth={state.maxDepth}
                questionIndex={state.questionIndex}
                questionCount={state.questionCount}
              />
            </div>

            {/* Live answered counter */}
            {(state.phase === "question" || state.phase === "locked") && (
              <div className="shrink-0 text-right">
                <p className="font-mono text-[1.3vh] uppercase tracking-[0.3em] text-cyan-300/60">
                  Answered
                </p>
                <p className="text-[3.6vh] font-black tabular-nums leading-none text-slate-100">
                  {formatNumber(state.answerCount)}
                  <span className="text-slate-500">/{formatNumber(state.playerCount)}</span>
                </p>
              </div>
            )}

            {showTimer && (
              <div className="shrink-0">
                <CountdownRing
                  remainingMs={remainingMs}
                  totalMs={totalMs}
                  muted={state.muted}
                />
              </div>
            )}
          </header>
        )}

        {/* --- Stage ------------------------------------------------------- */}
        <section className="relative min-h-0 flex-1 pt-[2.5vh]">
          <StageContent state={state} />
        </section>
      </div>
    </main>
  );
}

function StageContent({ state }: { state: ReturnType<typeof useScreenStream>["data"] }) {
  if (!state) return null;

  switch (state.phase) {
    case "lobby":
      return <Lobby state={state} />;
    case "betting":
      return <BettingStage state={state} />;
    case "question":
    case "reveal":
      return <QuestionStage state={state} />;
    case "locked":
      return <LockedStage state={state} />;
    case "scores":
      return <Leaderboard rows={state.leaderboard} title="Top 10" />;
    case "finished":
      return (
        <div className="flex h-full flex-col gap-[2.5vh]">
          <div className="shrink-0">
            <FinishedStage state={state} />
          </div>
          <div className="min-h-0 flex-1">
            <Leaderboard rows={state.leaderboard} showDelta={false} title="Final standings" medals />
          </div>
        </div>
      );
    default:
      return null;
  }
}

/** Total length of the current countdown window, for the ring's arc. */
function questionWindowMs(state: NonNullable<ReturnType<typeof useScreenStream>["data"]>): number {
  const question = state.question;
  if (!question) return 1;
  if (state.phase === "betting" && question.type === "bet") {
    return question.betTimeLimit * 1000;
  }
  return question.timeLimit * 1000;
}
