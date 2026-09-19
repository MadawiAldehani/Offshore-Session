"use client";

/**
 * /play — the player's phone.
 *
 * Mobile-first and one-handed: a sticky score header, a single primary action
 * per screen, and nothing that requires two thumbs or a scroll to reach.
 *
 * The phone never receives the correct answer until the reveal — see
 * lib/store/projections.ts.
 */

import { useCallback, useEffect, useState } from "react";
import {
  type AnswerPayload,
  BetInput,
  ChoiceInput,
  HeatmapInput,
  MultiInput,
  RangeInput,
  SliderInput,
} from "@/components/play/AnswerInputs";
import { formatNumber, formatValue, ordinal } from "@/lib/client/format";
import {
  loadPlayer,
  savePlayer,
  useCountdown,
  usePlayStream,
  usePost,
  type StoredPlayer,
} from "@/lib/client/useGameStream";
import { isChoicePrompt, isNumericPrompt, type PlayView } from "@/lib/types";

export default function PlayPage() {
  const [player, setPlayer] = useState<StoredPlayer | null>(null);
  const [restored, setRestored] = useState(false);

  // Restore identity so a refresh (or a phone locking itself) doesn't drop you.
  useEffect(() => {
    setPlayer(loadPlayer());
    setRestored(true);
  }, []);

  const { data: state, connected, clockOffset } = usePlayStream(player?.playerId ?? null);

  // The server was reset (or restarted) while we held a stale id — send the
  // player back to the join screen instead of leaving them on a dead session.
  useEffect(() => {
    if (state && state.me === null && player) {
      savePlayer(null);
      setPlayer(null);
    }
  }, [state, player]);

  if (!restored) return <Shell><Centered>Loading…</Centered></Shell>;

  if (!player) {
    return (
      <Shell>
        <JoinForm
          onJoined={(joined) => {
            savePlayer(joined);
            setPlayer(joined);
          }}
        />
      </Shell>
    );
  }

  if (!state) {
    return (
      <Shell>
        <Centered>{connected ? "Syncing…" : "Connecting…"}</Centered>
      </Shell>
    );
  }

  return <GameScreen state={state} clockOffset={clockOffset} connected={connected} />;
}

// ---------------------------------------------------------------------------
// Shell
// ---------------------------------------------------------------------------

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main
      className="relative flex min-h-dvh flex-col bg-abyss"
      style={{
        // Keep content clear of the notch and the home indicator.
        paddingTop: "env(safe-area-inset-top)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      <div className="pointer-events-none fixed inset-0 bg-gradient-to-b from-[#0b2044] via-[#061530] to-[#02060f]" />
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(34,211,238,0.14)_0%,transparent_55%)]" />
      <div className="relative flex min-h-dvh flex-col">{children}</div>
    </main>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 items-center justify-center px-6">
      <p className="font-mono text-sm uppercase tracking-[0.35em] text-cyan-300/60">
        {children}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Join
// ---------------------------------------------------------------------------

function JoinForm({ onJoined }: { onJoined: (player: StoredPlayer) => void }) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const post = usePost();

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const result = await post("/api/join", { name: name.trim() });
      onJoined({ playerId: result.playerId, name: result.name });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not join");
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-1 flex-col justify-center px-6 py-10">
      <p className="text-center font-mono text-[11px] uppercase tracking-[0.4em] text-cyan-300/70">
        Offshore Workshop
      </p>
      <h1 className="mt-2 text-center text-4xl font-black tracking-tight text-glow">
        Deepwater Quiz
      </h1>
      <p className="mt-3 text-center text-sm leading-relaxed text-slate-400">
        Pick a name your colleagues will recognise on the big screen.
      </p>

      <form onSubmit={submit} className="mt-8 flex flex-col gap-4">
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Your name"
          maxLength={20}
          autoFocus
          autoComplete="off"
          autoCapitalize="words"
          // enterKeyHint makes the iOS keyboard show "Go" instead of "return".
          enterKeyHint="go"
          className="w-full rounded-2xl border-2 border-cyan-400/30 bg-white/[0.06] px-5 py-5 text-center text-2xl font-bold text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-cyan-400/70 focus:bg-white/[0.09]"
        />

        <button
          type="submit"
          disabled={!name.trim() || busy}
          className="tap-target flex items-center justify-center border-2 border-amber bg-amber text-xl font-black text-abyss active:bg-amber-bright disabled:border-white/10 disabled:bg-white/5 disabled:text-slate-600"
        >
          {busy ? "Boarding…" : "Join the crew"}
        </button>

        {error && <p className="text-center text-sm text-rose-400">{error}</p>}
      </form>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Game
// ---------------------------------------------------------------------------

function GameScreen({
  state,
  clockOffset,
  connected,
}: {
  state: PlayView;
  clockOffset: number;
  connected: boolean;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const post = usePost();
  const { remainingSec } = useCountdown(state.endsAt, clockOffset);

  const questionId = state.question?.id;

  const answer = useCallback(
    async (payload: AnswerPayload) => {
      if (!state.me || !questionId) return;
      setSubmitting(true);
      setError(null);
      try {
        await post("/api/answer", {
          playerId: state.me.id,
          questionId,
          ...payload,
        });
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Could not send");
      } finally {
        setSubmitting(false);
      }
    },
    [post, questionId, state.me],
  );

  const bet = useCallback(
    async (amount: number) => {
      if (!state.me || !questionId) return;
      setSubmitting(true);
      setError(null);
      try {
        await post("/api/answer", { playerId: state.me.id, questionId, bet: amount });
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Could not send");
      } finally {
        setSubmitting(false);
      }
    },
    [post, questionId, state.me],
  );

  // Clear a stale error as soon as the phase moves on.
  useEffect(() => setError(null), [state.phase, questionId]);

  const urgent = state.phase === "question" && remainingSec <= 5 && remainingSec > 0;

  return (
    <Shell>
      {/* --- Sticky header ------------------------------------------------- */}
      <header className="sticky top-0 z-20 border-b border-white/10 bg-abyss/85 px-5 py-3 backdrop-blur-lg">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-base font-bold text-slate-100">
              {state.me?.name ?? "—"}
            </p>
            <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-cyan-300/60">
              {state.me && state.me.rank > 0
                ? `${ordinal(state.me.rank)} of ${state.playerCount}`
                : "Not ranked yet"}
            </p>
          </div>

          <div className="shrink-0 text-right">
            <p className="text-2xl font-black tabular-nums leading-none text-amber-bright">
              {formatNumber(state.me?.score ?? 0)}
            </p>
            <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-slate-500">
              points
            </p>
          </div>

          {(state.phase === "question" || state.phase === "betting") && (
            <div
              className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2 font-mono text-lg font-black tabular-nums transition-colors ${
                urgent
                  ? "animate-pulse-ring border-rose-500 text-rose-400"
                  : remainingSec <= 10
                    ? "border-amber text-amber-bright"
                    : "border-cyan-400/40 text-cyan-200"
              }`}
            >
              {Math.max(0, remainingSec)}
            </div>
          )}
        </div>
      </header>

      {/* --- Body ---------------------------------------------------------- */}
      <div className="flex-1 px-5 pb-8 pt-5">
        <PlayBody state={state} onAnswer={answer} onBet={bet} submitting={submitting} />

        {error && (
          <p className="mt-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-center text-sm text-rose-300">
            {error}
          </p>
        )}
      </div>

      {!connected && (
        <div className="sticky bottom-0 bg-rose-500/90 py-2 text-center text-sm font-bold">
          Reconnecting…
        </div>
      )}
    </Shell>
  );
}

function PlayBody({
  state,
  onAnswer,
  onBet,
  submitting,
}: {
  state: PlayView;
  onAnswer: (payload: AnswerPayload) => void;
  onBet: (amount: number) => void;
  submitting: boolean;
}) {
  const question = state.question;

  switch (state.phase) {
    case "lobby":
      return (
        <Waiting
          title="You're aboard"
          detail="Keep this page open — the first question will appear here."
        />
      );

    case "betting": {
      const intro = question?.type === "bet" ? question.intro : undefined;
      return (
        <div className="flex flex-col gap-5">
          {/* Mirror the projector's drama so the phone feels like the same
              moment, not a detached form. */}
          <div className="animate-pop-in rounded-2xl border-2 border-rose-500/50 bg-rose-500/10 px-5 py-5 text-center">
            <p className="font-mono text-[10px] uppercase tracking-[0.35em] text-rose-300">
              ⚠️ Final round
            </p>
            <p className="mt-1 text-3xl font-black tracking-tight text-amber-bright">
              {intro?.headline ?? "DOUBLE OR LOSE"}
            </p>
            <p className="mt-1 text-sm text-slate-300">
              {intro?.subline ?? "You have reached a decision point."}
            </p>
          </div>

          <p className="text-center text-base font-semibold text-slate-200">
            You have{" "}
            <span className="text-amber-bright">
              {formatNumber(state.me?.score ?? 0)}
            </span>{" "}
            points — place your bet
          </p>

          <BetInput state={state} onBet={onBet} submitting={submitting} />
        </div>
      );
    }

    case "question": {
      if (!question) return <Waiting title="Get ready" detail="Loading the question…" />;

      if (state.lockedOut) {
        return (
          <Waiting
            title="Locked out"
            detail="Wrong answer on this one — you're out until the next question."
            tone="rose"
          />
        );
      }

      return (
        <div className="flex flex-col gap-5">
          <p className="text-lg font-bold leading-snug text-slate-200">{question.prompt}</p>

          {isChoicePrompt(question) && (
            <>
              {question.type === "pixel" && (
                <p className="-mt-2 text-sm text-cyan-300/70">
                  Answer early for more points — but a wrong guess ends your question.
                </p>
              )}
              <ChoiceInput state={state} onAnswer={onAnswer} submitting={submitting} />
            </>
          )}

          {question.type === "multi" && (
            <MultiInput state={state} onAnswer={onAnswer} submitting={submitting} />
          )}

          {isNumericPrompt(question) && (
            <SliderInput state={state} onAnswer={onAnswer} submitting={submitting} />
          )}

          {question.type === "range" && (
            <RangeInput state={state} onAnswer={onAnswer} submitting={submitting} />
          )}

          {question.type === "heatmap" && (
            <HeatmapInput state={state} onAnswer={onAnswer} submitting={submitting} />
          )}
        </div>
      );
    }

    case "locked":
      return (
        <Waiting title="Answers locked" detail="Eyes on the big screen for the reveal." />
      );

    case "reveal":
      return <RevealResult state={state} />;

    case "scores":
      return (
        <Waiting
          title={state.me ? `${ordinal(state.me.rank)} place` : "Standings"}
          detail={`${formatNumber(state.me?.score ?? 0)} points — leaderboard is on the screen.`}
        />
      );

    case "finished":
      return (
        <div className="flex flex-col gap-4">
          <Banner tone="amber" label="Final result">
            {state.me ? `${ordinal(state.me.rank)} of ${state.playerCount}` : "Game over"}
          </Banner>
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-8 text-center">
            <p className="text-5xl font-black tabular-nums text-amber-bright">
              {formatNumber(state.me?.score ?? 0)}
            </p>
            <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.3em] text-slate-500">
              final score
            </p>
          </div>
        </div>
      );

    default:
      return null;
  }
}

/** What the player personally scored on the question just revealed. */
function RevealResult({ state }: { state: PlayView }) {
  const question = state.question;
  const points = state.myAnswer?.points;
  const answered = state.myAnswer !== null;

  if (!answered) {
    return (
      <Waiting
        title="No answer in"
        detail="You didn't get one in for that round — next question's coming."
        tone="rose"
      />
    );
  }

  const gained = points ?? 0;
  const positive = gained > 0;

  return (
    <div className="flex flex-col gap-4">
      <div
        className={`animate-pop-in rounded-2xl border-2 px-5 py-8 text-center ${
          positive
            ? "border-emerald-400/50 bg-emerald-400/10"
            : "border-rose-500/40 bg-rose-500/10"
        }`}
      >
        <p
          className={`font-mono text-[11px] uppercase tracking-[0.3em] ${
            positive ? "text-emerald-300/80" : "text-rose-300/80"
          }`}
        >
          {question?.type === "bet"
            ? positive
              ? "Bet won"
              : "Bet lost"
            : positive
              ? "Points earned"
              : "No points"}
        </p>
        <p
          className={`mt-1 text-6xl font-black tabular-nums ${
            positive ? "text-emerald-300" : "text-rose-300"
          }`}
        >
          {positive ? "+" : ""}
          {formatNumber(gained)}
        </p>
      </div>

      <CorrectAnswer state={state} />
    </div>
  );
}

/** The correct answer, now that the server has released it. */
function CorrectAnswer({ state }: { state: PlayView }) {
  const question = state.question;
  if (!question) return null;

  let value: string | null = null;
  if (isChoicePrompt(question) && question.correctIndex !== undefined) {
    value = question.options[question.correctIndex];
  } else if (
    question.type === "range" &&
    question.answerMin !== undefined &&
    question.answerMax !== undefined
  ) {
    value = `${formatValue(question.answerMin, "", question.thousands ?? true)} – ${formatValue(
      question.answerMax,
      question.unit,
      question.thousands ?? true,
    )}`;
  } else if (question.type === "multi" && question.correctIndexes !== undefined) {
    value = question.correctIndexes.map((i) => question.options[i]).join("  ·  ");
  } else if (isNumericPrompt(question) && question.answer !== undefined) {
    value = formatValue(question.answer, question.unit, question.thousands ?? true);
  }

  if (!value) return null;

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-4 text-center">
      <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-slate-500">
        Correct answer
      </p>
      <p className="mt-1 text-xl font-bold text-slate-100">{value}</p>
    </div>
  );
}

function Waiting({
  title,
  detail,
  tone = "cyan",
}: {
  title: string;
  detail: string;
  tone?: "cyan" | "rose";
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div
        className={`mb-6 h-14 w-14 rounded-full border-4 ${
          tone === "rose"
            ? "border-rose-500/30 border-t-rose-500"
            : "border-cyan-400/20 border-t-cyan-400"
        } animate-spin`}
        style={{ animationDuration: "1.6s" }}
      />
      <h2 className="text-2xl font-black text-slate-100">{title}</h2>
      <p className="mt-2 max-w-xs text-sm leading-relaxed text-slate-400">{detail}</p>
    </div>
  );
}

function Banner({
  label,
  children,
  tone,
}: {
  label: string;
  children: React.ReactNode;
  tone: "amber" | "cyan";
}) {
  return (
    <div
      className={`rounded-2xl border-2 px-5 py-4 text-center ${
        tone === "amber"
          ? "border-amber/40 bg-amber/10"
          : "border-cyan-400/30 bg-cyan-400/10"
      }`}
    >
      <p
        className={`font-mono text-[10px] uppercase tracking-[0.35em] ${
          tone === "amber" ? "text-amber-bright/80" : "text-cyan-300/80"
        }`}
      >
        {label}
      </p>
      <p className="mt-1 text-lg font-bold leading-snug text-slate-100">{children}</p>
    </div>
  );
}
