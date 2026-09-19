"use client";

/**
 * /admin — the control panel.
 *
 * Designed to work on a laptop or a phone held in one hand while you talk.
 * The big primary button is always the next thing you want to press, so you
 * can run the whole game without reading the screen carefully.
 */

import { useCallback, useState } from "react";
import { formatNumber } from "@/lib/client/format";
import { useAdminStream, useCountdown, usePost } from "@/lib/client/useGameStream";
import type { AdminView, Phase, QuestionType } from "@/lib/types";

const TYPE_BADGES: Record<QuestionType, { label: string; className: string }> = {
  mcq: { label: "MCQ", className: "bg-cyan-500/20 text-cyan-300 border-cyan-500/40" },
  multi: { label: "MULTI", className: "bg-teal-500/20 text-teal-300 border-teal-500/40" },
  slider: { label: "SLIDER", className: "bg-violet-500/20 text-violet-300 border-violet-500/40" },
  range: { label: "RANGE", className: "bg-indigo-500/20 text-indigo-300 border-indigo-500/40" },
  heatmap: { label: "HEATMAP", className: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40" },
  pixel: { label: "PIXEL", className: "bg-pink-500/20 text-pink-300 border-pink-500/40" },
  bet: { label: "BET", className: "bg-amber-500/20 text-amber-300 border-amber-500/40" },
};

export default function AdminPage() {
  const { data: state, connected, clockOffset } = useAdminStream();
  const { remainingSec } = useCountdown(state?.endsAt ?? null, clockOffset);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const post = usePost();

  const act = useCallback(
    async (action: string, extra: Record<string, unknown> = {}) => {
      setBusy(true);
      setError(null);
      try {
        await post("/api/admin", { action, ...extra });
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Action failed");
      } finally {
        setBusy(false);
      }
    },
    [post],
  );

  if (!state) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-abyss">
        <p className="font-mono text-sm uppercase tracking-[0.35em] text-cyan-300/60">
          {connected ? "Loading…" : "Connecting…"}
        </p>
      </main>
    );
  }

  const primary = primaryAction(state);

  return (
    <main className="min-h-dvh bg-abyss pb-24 text-slate-100">
      <div className="mx-auto w-full max-w-5xl px-4 py-5 sm:px-6">
        {/* --- Header ------------------------------------------------------ */}
        <header className="mb-5 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-black tracking-tight">Control panel</h1>
            <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-cyan-300/60">
              Offshore workshop quiz
            </p>
          </div>
          <div className="flex items-center gap-2">
            <PhaseBadge phase={state.phase} />
            <span
              className={`h-2.5 w-2.5 rounded-full ${connected ? "bg-emerald-400" : "bg-rose-500"}`}
              title={connected ? "Connected" : "Reconnecting"}
            />
          </div>
        </header>

        {/* --- Live stats -------------------------------------------------- */}
        <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Joined" value={formatNumber(state.playerCount)} accent="cyan" />
          <Stat
            label={state.phase === "betting" ? "Bets in" : "Answered"}
            value={
              state.phase === "betting"
                ? `${formatNumber(state.betCount)}/${formatNumber(state.playerCount)}`
                : `${formatNumber(state.answerCount)}/${formatNumber(state.playerCount)}`
            }
            accent="amber"
          />
          <Stat
            label="Time left"
            value={state.endsAt ? `${Math.max(0, remainingSec)}s` : "—"}
            accent={remainingSec <= 5 && state.endsAt ? "rose" : "slate"}
          />
          <Stat label="Bots" value={formatNumber(state.botCount)} accent="slate" />
        </div>

        {/* --- Primary action ---------------------------------------------- */}
        <button
          onClick={() => act(primary.action)}
          disabled={busy || primary.disabled}
          className="mb-3 w-full rounded-2xl bg-gradient-to-r from-amber-deep to-amber px-6 py-6 text-xl font-black text-abyss shadow-[0_8px_30px_rgba(255,176,32,0.25)] transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
        >
          {primary.label}
        </button>

        {/* --- Secondary controls ------------------------------------------ */}
        <div className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <button
            className="admin-btn"
            disabled={busy || state.phase !== "betting"}
            onClick={() => act("lockBets")}
          >
            Lock bets
          </button>
          <button
            className="admin-btn"
            disabled={busy || state.phase !== "question"}
            onClick={() => act("lock")}
          >
            Lock answers
          </button>
          <button
            className="admin-btn"
            disabled={busy || !["question", "locked"].includes(state.phase)}
            onClick={() => act("reveal")}
          >
            Reveal
          </button>
          <button
            className="admin-btn"
            disabled={busy || state.phase === "lobby"}
            onClick={() => act("next")}
          >
            Next →
          </button>
        </div>

        {/* --- Demo tools --------------------------------------------------- */}
        <section className="mb-5 rounded-2xl border border-amber/25 bg-amber/[0.06] p-4">
          <h2 className="mb-1 text-sm font-bold text-amber-bright">Demo tools</h2>
          <p className="mb-3 text-xs leading-relaxed text-slate-400">
            Spawn bots that join and answer every question with realistic guesses, so you
            can run the full experience on your own.
          </p>
          <div className="flex flex-wrap gap-2">
            <button className="admin-btn" disabled={busy} onClick={() => act("spawnBots", { count: 50 })}>
              🤖 Simulate 50 players
            </button>
            <button className="admin-btn" disabled={busy} onClick={() => act("spawnBots", { count: 10 })}>
              +10
            </button>
            <button
              className="admin-btn"
              disabled={busy || state.botCount === 0}
              onClick={() => act("removeBots")}
            >
              Remove bots
            </button>
            <button className="admin-btn" disabled={busy} onClick={() => act("mute", { muted: !state.muted })}>
              {state.muted ? "🔇 Sound off" : "🔊 Sound on"}
            </button>
          </div>
        </section>

        {/* --- Question list ------------------------------------------------ */}
        <section className="mb-5">
          <h2 className="mb-2 font-mono text-[10px] uppercase tracking-[0.3em] text-slate-500">
            Questions
          </h2>
          <ol className="flex flex-col gap-2">
            {state.questions.map((question, index) => {
              const badge = TYPE_BADGES[question.type];
              const isCurrent = index === state.questionIndex;
              return (
                <li key={question.id}>
                  <button
                    onClick={() => act("goTo", { index })}
                    disabled={busy}
                    className={`flex w-full items-center gap-3 rounded-xl border px-3 py-3 text-left transition active:scale-[0.99] ${
                      isCurrent
                        ? "border-amber/60 bg-amber/10"
                        : "border-white/10 bg-white/[0.03] hover:bg-white/[0.06]"
                    }`}
                  >
                    <span className="w-5 shrink-0 text-center font-mono text-xs text-slate-500">
                      {index + 1}
                    </span>
                    <span
                      className={`shrink-0 rounded-md border px-2 py-0.5 font-mono text-[10px] font-bold ${badge.className}`}
                    >
                      {badge.label}
                    </span>
                    <span
                      className={`min-w-0 flex-1 truncate text-sm ${
                        isCurrent ? "font-bold text-amber-bright" : "text-slate-300"
                      }`}
                    >
                      {question.prompt}
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        </section>

        {/* --- Standings ----------------------------------------------------- */}
        {state.leaderboard.length > 0 && (
          <section className="mb-5">
            <h2 className="mb-2 font-mono text-[10px] uppercase tracking-[0.3em] text-slate-500">
              Top 10
            </h2>
            <ol className="flex flex-col gap-1">
              {state.leaderboard.map((row) => (
                <li
                  key={row.playerId}
                  className="flex items-center gap-3 rounded-lg bg-white/[0.03] px-3 py-2 text-sm"
                >
                  <span className="w-5 text-center font-mono text-xs text-slate-500">{row.rank}</span>
                  <span className="min-w-0 flex-1 truncate">{row.name}</span>
                  {row.delta !== 0 && (
                    <span
                      className={`font-mono text-xs tabular-nums ${
                        row.delta > 0 ? "text-emerald-400" : "text-rose-400"
                      }`}
                    >
                      {row.delta > 0 ? "+" : ""}
                      {formatNumber(row.delta)}
                    </span>
                  )}
                  <span className="w-16 text-right font-mono tabular-nums text-amber-bright">
                    {formatNumber(row.score)}
                  </span>
                </li>
              ))}
            </ol>
          </section>
        )}

        {/* --- Reset --------------------------------------------------------- */}
        <ResetButton busy={busy} onReset={() => act("reset")} />

        {error && (
          <p className="mt-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-center text-sm text-rose-300">
            {error}
          </p>
        )}
      </div>
    </main>
  );
}

// ---------------------------------------------------------------------------

/** The one button you should be pressing next, given the phase. */
function primaryAction(state: AdminView): {
  action: string;
  label: string;
  disabled?: boolean;
} {
  const isLast = state.questionIndex >= state.questionCount - 1;

  switch (state.phase) {
    case "lobby":
      return { action: "start", label: "▶  Start question 1" };
    case "betting":
      return { action: "lockBets", label: "🔒  Lock bets & show question" };
    case "question":
      return { action: "lock", label: "🔒  Lock answers" };
    case "locked":
      return { action: "reveal", label: "✨  Reveal answer" };
    case "reveal":
      return { action: "next", label: "📊  Show leaderboard" };
    case "scores":
      return {
        action: "next",
        label: isLast ? "🏁  Final results" : `▶  Start question ${state.questionIndex + 2}`,
      };
    case "finished":
      return { action: "next", label: "🏁  Game over", disabled: true };
    default:
      return { action: "next", label: "Next" };
  }
}

function PhaseBadge({ phase }: { phase: Phase }) {
  const colors: Record<Phase, string> = {
    lobby: "bg-slate-500/20 text-slate-300",
    betting: "bg-orange-500/20 text-orange-300",
    question: "bg-emerald-500/20 text-emerald-300",
    locked: "bg-amber-500/20 text-amber-300",
    reveal: "bg-cyan-500/20 text-cyan-300",
    scores: "bg-violet-500/20 text-violet-300",
    finished: "bg-pink-500/20 text-pink-300",
  };
  return (
    <span className={`rounded-full px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-widest ${colors[phase]}`}>
      {phase}
    </span>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent: "cyan" | "amber" | "rose" | "slate";
}) {
  const colors = {
    cyan: "text-cyan-300",
    amber: "text-amber-bright",
    rose: "text-rose-400",
    slate: "text-slate-300",
  };
  return (
    <div className="panel px-3 py-2.5">
      <p className="font-mono text-[9px] uppercase tracking-[0.25em] text-slate-500">{label}</p>
      <p className={`text-xl font-black tabular-nums ${colors[accent]}`}>{value}</p>
    </div>
  );
}

/** Two-step reset — a stray tap mid-game would be unrecoverable. */
function ResetButton({ busy, onReset }: { busy: boolean; onReset: () => void }) {
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <button
        onClick={() => setConfirming(true)}
        className="w-full rounded-xl border border-rose-500/30 px-4 py-3 text-sm font-semibold text-rose-400 transition hover:bg-rose-500/10"
      >
        Reset game
      </button>
    );
  }

  return (
    <div className="flex gap-2">
      <button
        onClick={() => {
          onReset();
          setConfirming(false);
        }}
        disabled={busy}
        className="flex-1 rounded-xl bg-rose-600 px-4 py-3 text-sm font-bold text-white transition active:scale-95 disabled:opacity-50"
      >
        Yes, wipe everything
      </button>
      <button
        onClick={() => setConfirming(false)}
        className="flex-1 rounded-xl border border-white/15 px-4 py-3 text-sm font-semibold text-slate-300 transition hover:bg-white/5"
      >
        Cancel
      </button>
    </div>
  );
}
