"use client";

/**
 * The phone-side answer widgets, one per question type.
 *
 * Shared rules:
 *  - every control is at least 88px tall and reachable with one thumb
 *  - a submitted answer swaps to a confirmation state, never a dead screen
 *  - nothing here knows the correct answer; it is not in the payload yet
 */

import { useEffect, useRef, useState } from "react";
import { artDataUrl } from "@/components/art/svg";
import { formatValue } from "@/lib/client/format";
import { isChoicePrompt, isNumericPrompt, type PlayView } from "@/lib/types";

const LETTERS = ["A", "B", "C", "D", "E", "F"];

/** An answer payload: scalars for most types, an array for multi-select. */
export type AnswerPayload = Record<string, number | number[]>;

interface Props {
  state: PlayView;
  onAnswer: (payload: AnswerPayload) => void;
  submitting: boolean;
}

// ---------------------------------------------------------------------------
// Multiple choice (also used by the pixel-reveal question)
// ---------------------------------------------------------------------------

export function ChoiceInput({ state, onAnswer, submitting }: Props) {
  const question = state.question;
  // Also handles the choice-mode betting finale.
  if (!question || !isChoicePrompt(question)) return null;

  const chosen = state.myAnswer?.optionIndex;
  const answered = chosen !== undefined;

  return (
    <div className="flex flex-col gap-3">
      {question.options.map((option, index) => {
        const isChosen = chosen === index;
        return (
          <button
            key={index}
            disabled={answered || submitting || state.lockedOut}
            onClick={() => onAnswer({ optionIndex: index })}
            className={`tap-target flex items-center gap-4 border-2 ${
              isChosen
                ? "border-amber bg-amber/20 text-amber-bright"
                : answered
                  ? "border-white/8 bg-white/[0.03] text-slate-500"
                  : "border-cyan-400/30 bg-cyan-400/[0.08] text-slate-100 active:bg-cyan-400/20"
            }`}
          >
            <span
              className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-xl font-black ${
                isChosen ? "bg-amber text-abyss" : "bg-white/10 text-cyan-200"
              }`}
            >
              {LETTERS[index]}
            </span>
            <span className="min-w-0 flex-1 text-lg leading-snug">{option}</span>
          </button>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Multiple response — pick a set, then submit
// ---------------------------------------------------------------------------

export function MultiInput({ state, onAnswer, submitting }: Props) {
  const question = state.question;
  const [picked, setPicked] = useState<number[]>([]);

  // Clear the selection when the question changes.
  const questionId = question?.id;
  useEffect(() => setPicked([]), [questionId]);

  if (!question || question.type !== "multi") return null;

  const submitted = Array.isArray(state.myAnswer?.optionIndexes);

  if (submitted) {
    const chosen = state.myAnswer!.optionIndexes as number[];
    return (
      <Submitted label={`${chosen.length} selected`}>
        {chosen.map((i) => LETTERS[i]).join(" + ")}
      </Submitted>
    );
  }

  const toggle = (index: number) =>
    setPicked((current) =>
      current.includes(index)
        ? current.filter((i) => i !== index)
        : [...current, index],
    );

  return (
    <div className="flex flex-col gap-3">
      <p className="-mt-1 text-sm font-semibold text-cyan-300/80">
        Pick every answer you think is right, then submit.
      </p>

      {question.options.map((option, index) => {
        const isPicked = picked.includes(index);
        return (
          <button
            key={index}
            disabled={submitting}
            onClick={() => toggle(index)}
            className={`tap-target flex items-center gap-4 border-2 ${
              isPicked
                ? "border-amber bg-amber/20 text-amber-bright"
                : "border-cyan-400/30 bg-cyan-400/[0.08] text-slate-100 active:bg-cyan-400/20"
            }`}
          >
            {/* A checkbox, not a letter tile — it has to read as multi-select
                at a glance or people submit after one tap. */}
            <span
              className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border-2 text-xl font-black ${
                isPicked
                  ? "border-amber bg-amber text-abyss"
                  : "border-white/25 bg-white/5 text-cyan-200"
              }`}
            >
              {isPicked ? "✓" : LETTERS[index]}
            </span>
            <span className="min-w-0 flex-1 text-lg leading-snug">{option}</span>
          </button>
        );
      })}

      <button
        disabled={picked.length === 0 || submitting}
        onClick={() => onAnswer({ optionIndexes: picked })}
        className="tap-target flex items-center justify-center border-2 border-amber bg-amber text-xl font-black text-abyss active:bg-amber-bright disabled:border-white/10 disabled:bg-white/5 disabled:text-slate-500"
      >
        {picked.length === 0
          ? "Select at least one"
          : submitting
            ? "Sending…"
            : `Submit ${picked.length} answer${picked.length > 1 ? "s" : ""}`}
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Slider guess
// ---------------------------------------------------------------------------

export function SliderInput({ state, onAnswer, submitting }: Props) {
  const question = state.question;
  const isNumeric = question ? isNumericPrompt(question) : false;

  // Start in the middle of the range — no anchor toward either end.
  const [value, setValue] = useState(() =>
    question && isNumericPrompt(question)
      ? Math.round((question.min + question.max) / 2)
      : 0,
  );

  // Reset when the question changes, or the next slider question opens with
  // the previous one's value still in state.
  const questionId = question?.id;
  useEffect(() => {
    if (question && isNumericPrompt(question)) {
      setValue(Math.round((question.min + question.max) / 2));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questionId]);

  if (!question || !isNumericPrompt(question)) return null;

  const submitted = typeof state.myAnswer?.value === "number";
  const thousands = question.thousands ?? true;

  if (submitted) {
    return (
      <Submitted label="Your guess">
        {formatValue(state.myAnswer!.value as number, question.unit, thousands)}
      </Submitted>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-2xl border border-cyan-400/25 bg-cyan-400/[0.07] px-5 py-6 text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-cyan-300/70">
          Your guess
        </p>
        <p className="mt-1 text-4xl font-black tabular-nums text-amber-bright">
          {formatValue(value, question.unit, thousands)}
        </p>
      </div>

      <div className="px-1">
        <input
          type="range"
          className="offshore-slider"
          min={question.min}
          max={question.max}
          step={question.step}
          value={value}
          onChange={(event) => setValue(Number(event.target.value))}
          aria-label="Your guess"
        />
        <div className="flex justify-between font-mono text-xs text-slate-500">
          <span>{formatValue(question.min, question.unit, thousands)}</span>
          <span>{formatValue(question.max, question.unit, thousands)}</span>
        </div>
      </div>

      <button
        disabled={submitting}
        onClick={() => onAnswer({ value })}
        className="tap-target flex items-center justify-center border-2 border-amber bg-amber text-xl font-black text-abyss active:bg-amber-bright disabled:opacity-50"
      >
        {submitting ? "Sending…" : "Lock it in"}
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Range band — pick a low and a high
// ---------------------------------------------------------------------------

export function RangeInput({ state, onAnswer, submitting }: Props) {
  const question = state.question;
  const isRange = question?.type === "range";

  /**
   * Two separate sliders rather than one dual-handle track. A dual handle
   * needs custom pointer maths that is fragile on touch, and "flawless on a
   * phone" matters more here than looking clever. The band preview above them
   * gives the same read at a glance.
   *
   * Default sits deliberately off-centre and narrow, so submitting without
   * touching anything scores badly rather than accidentally well.
   */
  const [low, setLow] = useState(() =>
    isRange ? Math.round(question.min + (question.max - question.min) * 0.25) : 0,
  );
  const [high, setHigh] = useState(() =>
    isRange ? Math.round(question.min + (question.max - question.min) * 0.75) : 0,
  );

  const questionId = question?.id;
  useEffect(() => {
    if (isRange) {
      setLow(Math.round(question.min + (question.max - question.min) * 0.25));
      setHigh(Math.round(question.min + (question.max - question.min) * 0.75));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questionId]);

  if (!question || !isRange) return null;

  const thousands = question.thousands ?? true;
  const submitted =
    typeof state.myAnswer?.low === "number" && typeof state.myAnswer?.high === "number";

  if (submitted) {
    return (
      <Submitted label="Your range">
        {formatValue(state.myAnswer!.low as number, "", thousands)} –{" "}
        {formatValue(state.myAnswer!.high as number, question.unit, thousands)}
      </Submitted>
    );
  }

  const span = question.max - question.min;
  const leftPct = ((low - question.min) / span) * 100;
  const widthPct = ((high - low) / span) * 100;

  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-2xl border border-cyan-400/25 bg-cyan-400/[0.07] px-5 py-5 text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-cyan-300/70">
          Your range
        </p>
        <p className="mt-1 text-3xl font-black tabular-nums text-amber-bright">
          {formatValue(low, "", thousands)} – {formatValue(high, question.unit, thousands)}
        </p>

        {/* Visual band, so the two sliders still read as one range. */}
        <div className="relative mt-4 h-3 w-full overflow-hidden rounded-full bg-white/10">
          <div
            className="absolute inset-y-0 rounded-full bg-gradient-to-r from-cyan-deep to-cyan"
            style={{ left: `${leftPct}%`, width: `${Math.max(widthPct, 1.5)}%` }}
          />
        </div>
      </div>

      <div className="px-1">
        <label className="font-mono text-[11px] uppercase tracking-[0.25em] text-slate-400">
          Shallowest
        </label>
        <input
          type="range"
          className="offshore-slider"
          min={question.min}
          max={question.max}
          step={question.step}
          value={low}
          // Keep the handles from crossing over each other.
          onChange={(event) => {
            const next = Number(event.target.value);
            setLow(next);
            if (next > high) setHigh(next);
          }}
          aria-label="Shallowest value"
        />
      </div>

      <div className="px-1">
        <label className="font-mono text-[11px] uppercase tracking-[0.25em] text-slate-400">
          Deepest
        </label>
        <input
          type="range"
          className="offshore-slider"
          min={question.min}
          max={question.max}
          step={question.step}
          value={high}
          onChange={(event) => {
            const next = Number(event.target.value);
            setHigh(next);
            if (next < low) setLow(next);
          }}
          aria-label="Deepest value"
        />
        <div className="flex justify-between font-mono text-xs text-slate-500">
          <span>{formatValue(question.min, question.unit, thousands)}</span>
          <span>{formatValue(question.max, question.unit, thousands)}</span>
        </div>
      </div>

      <button
        disabled={submitting}
        onClick={() => onAnswer({ low, high })}
        className="tap-target flex items-center justify-center border-2 border-amber bg-amber text-xl font-black text-abyss active:bg-amber-bright disabled:opacity-50"
      >
        {submitting ? "Sending…" : "Lock it in"}
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Heatmap tap
// ---------------------------------------------------------------------------

export function HeatmapInput({ state, onAnswer, submitting }: Props) {
  const question = state.question;
  const [pin, setPin] = useState<{ x: number; y: number } | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  if (!question || question.type !== "heatmap") return null;

  const submitted = typeof state.myAnswer?.x === "number";
  const placed = submitted
    ? { x: state.myAnswer!.x as number, y: state.myAnswer!.y as number }
    : pin;

  /**
   * Convert a tap into normalised image coordinates. The box is exactly 4:3 and
   * the image fills it, so this maps one-to-one onto the projector's copy.
   */
  const handleTap = (event: React.PointerEvent<HTMLDivElement>) => {
    if (submitted) return;
    const box = boxRef.current;
    if (!box) return;
    const rect = box.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width;
    const y = (event.clientY - rect.top) / rect.height;
    setPin({ x: clamp01(x), y: clamp01(y) });
  };

  return (
    <div className="flex flex-col gap-4">
      <div
        ref={boxRef}
        onPointerDown={handleTap}
        className={`relative w-full overflow-hidden rounded-2xl border-2 ${
          submitted ? "border-white/10" : "border-cyan-400/40"
        } ${submitted ? "" : "cursor-crosshair"}`}
        // The map is a tap surface, not a scroll surface. The aspect ratio must
        // match the projector's copy exactly, or pins land somewhere else.
        style={{ touchAction: "none", aspectRatio: String(question.aspect ?? 4 / 3) }}
      >
        <img
          src={artDataUrl(question.image)}
          alt="Structure map — tap to place your pin"
          className="pointer-events-none h-full w-full object-fill"
          draggable={false}
        />

        {placed && (
          <div
            // Same reason as the projector's star: pin-land animates
            // `transform`, so centring must not rely on a translate.
            className="pointer-events-none absolute h-6 w-6 animate-pin-land rounded-full border-[3px] border-abyss bg-amber shadow-[0_0_18px_6px_rgba(255,176,32,0.6)]"
            style={{
              left: `${placed.x * 100}%`,
              top: `${placed.y * 100}%`,
              marginLeft: "-0.75rem",
              marginTop: "-0.75rem",
            }}
          />
        )}

        {!placed && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <p className="rounded-full bg-abyss/80 px-5 py-2.5 text-sm font-semibold text-cyan-200 backdrop-blur">
              Tap the map to drop your pin
            </p>
          </div>
        )}
      </div>

      {submitted ? (
        <Submitted label="Pin dropped">Waiting for the reveal…</Submitted>
      ) : (
        <button
          disabled={!pin || submitting}
          onClick={() => pin && onAnswer({ x: pin.x, y: pin.y })}
          className="tap-target flex items-center justify-center border-2 border-amber bg-amber text-xl font-black text-abyss active:bg-amber-bright disabled:border-white/10 disabled:bg-white/5 disabled:text-slate-500"
        >
          {pin ? (submitting ? "Sending…" : "Confirm pin") : "Tap the map first"}
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Betting slider (wager placement, before the question is shown)
// ---------------------------------------------------------------------------

export function BetInput({
  state,
  onBet,
  submitting,
}: {
  state: PlayView;
  onBet: (amount: number) => void;
  submitting: boolean;
}) {
  const score = state.me?.score ?? 0;
  const [wager, setWager] = useState(() => Math.round(score / 2));

  // If points land while the betting window is open, keep the wager in range.
  useEffect(() => {
    setWager((current) => Math.min(current, score));
  }, [score]);

  if (state.myBet) {
    return (
      <Submitted label="Wager placed">
        {state.myBet.amount.toLocaleString("en-US")} pts
      </Submitted>
    );
  }

  if (score <= 0) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-8 text-center">
        <p className="text-lg font-bold text-slate-300">No points to bet</p>
        <p className="mt-2 text-sm leading-relaxed text-slate-500">
          You can still answer the final question — you just have nothing at stake.
        </p>
      </div>
    );
  }

  const percent = score > 0 ? Math.round((wager / score) * 100) : 0;

  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-2xl border border-orange-400/30 bg-orange-500/10 px-5 py-6 text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-orange-300/80">
          Your wager
        </p>
        <p className="mt-1 text-5xl font-black tabular-nums text-orange-300">
          {wager.toLocaleString("en-US")}
        </p>
        <p className="mt-1 text-sm text-slate-400">
          {percent}% of your {score.toLocaleString("en-US")} points
        </p>
      </div>

      <div className="px-1">
        <input
          type="range"
          className="offshore-slider bet-slider"
          min={0}
          max={score}
          step={Math.max(1, Math.round(score / 100))}
          value={wager}
          onChange={(event) => setWager(Number(event.target.value))}
          aria-label="Wager amount"
        />
        <div className="flex justify-between font-mono text-xs text-slate-500">
          <span>Safe · 0</span>
          <span>All in · {score.toLocaleString("en-US")}</span>
        </div>
      </div>

      {/* Quick picks — faster than dragging on a small screen. */}
      <div className="grid grid-cols-4 gap-2">
        {[0, 0.25, 0.5, 1].map((fraction) => (
          <button
            key={fraction}
            onClick={() => setWager(Math.round(score * fraction))}
            className="rounded-xl border border-white/15 bg-white/5 py-3 text-sm font-bold text-slate-300 active:scale-95 active:bg-white/10"
          >
            {fraction === 0 ? "None" : fraction === 1 ? "All in" : `${fraction * 100}%`}
          </button>
        ))}
      </div>

      <button
        disabled={submitting}
        onClick={() => onBet(wager)}
        className="tap-target flex items-center justify-center border-2 border-orange-400 bg-orange-500 text-xl font-black text-abyss active:bg-orange-400 disabled:opacity-50"
      >
        {submitting ? "Placing…" : "Place bet"}
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------

function Submitted({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="animate-pop-in rounded-2xl border-2 border-emerald-400/40 bg-emerald-400/10 px-5 py-8 text-center">
      <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-emerald-300/80">
        {label}
      </p>
      <p className="mt-2 text-3xl font-black text-emerald-300">{children}</p>
    </div>
  );
}

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}
