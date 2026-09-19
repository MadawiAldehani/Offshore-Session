"use client";

/**
 * The projector's question area. Picks a layout per question type and handles
 * the asking / locked / reveal states for each.
 */

import { formatNumber } from "@/lib/client/format";
import { isChoicePrompt, isNumericPrompt, type ScreenView } from "@/lib/types";
import { Histogram } from "./Histogram";
import { HeatmapBoard } from "./HeatmapBoard";
import { PixelBoard, StagePoints } from "./PixelBoard";
import { RangeChart } from "./RangeChart";

const LETTERS = ["A", "B", "C", "D", "E", "F"];

export function QuestionStage({ state }: { state: ScreenView }) {
  const { question } = state;
  if (!question) return null;

  const revealed = state.revealed;

  return (
    <div className="flex h-full w-full flex-col">
      {/* --- Prompt -------------------------------------------------------- */}
      <h1
        className={`shrink-0 text-center font-black leading-[1.08] tracking-tight text-glow ${
          question.prompt.length > 90 ? "text-[4.2vh]" : "text-[5.4vh]"
        }`}
      >
        {question.prompt}
      </h1>

      {/* --- Body ---------------------------------------------------------- */}
      <div className="mt-[2.4vh] min-h-0 flex-1">
        {(question.type === "mcq" ||
          (question.type === "bet" && question.mode === "choice")) && (
          <MCQStage state={state} />
        )}
        {question.type === "multi" && <MultiStage state={state} />}
        {question.type === "pixel" && <PixelStage state={state} />}
        {isNumericPrompt(question) && <SliderStage state={state} />}
        {question.type === "range" && <RangeStage state={state} />}
        {question.type === "heatmap" && <HeatmapStage state={state} />}
      </div>

      {/* --- Factoid on reveal --------------------------------------------- */}
      {revealed && question.factoid && (
        <p className="mt-[2vh] shrink-0 animate-fade-up text-center text-[2.3vh] italic text-cyan-200/70">
          {question.factoid}
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Multiple choice
// ---------------------------------------------------------------------------

function MCQStage({ state }: { state: ScreenView }) {
  const question = state.question;
  // Serves plain MCQs and the choice-mode betting finale.
  if (!question || !isChoicePrompt(question) || question.type === "pixel") return null;

  const correctIndex = question.correctIndex;
  const revealed = state.revealed && typeof correctIndex === "number";
  const maxCount = Math.max(1, ...state.optionCounts);

  return (
    <div className="grid h-full grid-cols-2 content-center gap-[2vh]">
      {question.options.map((option, index) => {
        const isCorrect = revealed && index === correctIndex;
        const isWrong = revealed && index !== correctIndex;
        const count = state.optionCounts[index] ?? 0;

        return (
          <div
            key={index}
            className={`relative flex items-center gap-[1.6vw] overflow-hidden rounded-[1.6vh] border-[0.35vh] px-[2vw] py-[2.6vh] transition-all duration-700 ${
              isCorrect
                ? "scale-[1.03] border-emerald-400 bg-emerald-400/20 shadow-[0_0_50px_rgba(52,211,153,0.5)]"
                : isWrong
                  ? "border-white/10 bg-white/[0.02] opacity-45"
                  : "border-cyan-400/30 bg-cyan-400/[0.07]"
            }`}
          >
            {/* Result bar behind the text, only after the reveal. */}
            {revealed && (
              <div
                className={`absolute inset-y-0 left-0 transition-[width] duration-[900ms] ease-out ${
                  isCorrect ? "bg-emerald-400/20" : "bg-white/[0.04]"
                }`}
                style={{ width: `${(count / maxCount) * 100}%` }}
              />
            )}

            <span
              className={`relative flex h-[7.6vh] w-[7.6vh] shrink-0 items-center justify-center rounded-[1.2vh] text-[3.9vh] font-black ${
                isCorrect ? "bg-emerald-400 text-abyss" : "bg-white/10 text-cyan-200"
              }`}
            >
              {LETTERS[index]}
            </span>

            {/* Sized for the back of a 30 m room. Long options wrap to two
                lines rather than shrinking — the grid has the height for it. */}
            <span className="relative min-w-0 flex-1 text-[3.9vh] font-bold leading-[1.15]">
              {option}
            </span>

            {revealed && (
              <span className="relative shrink-0 font-mono text-[2.8vh] font-bold tabular-nums text-slate-300">
                {count}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Multiple response
// ---------------------------------------------------------------------------

function MultiStage({ state }: { state: ScreenView }) {
  const question = state.question;
  if (!question || question.type !== "multi") return null;

  const correct = question.correctIndexes;
  const revealed = state.revealed && Array.isArray(correct);
  const maxCount = Math.max(1, ...state.optionCounts);

  return (
    <div className="flex h-full flex-col justify-center gap-[1.8vh]">
      <p className="text-center font-mono text-[2vh] uppercase tracking-[0.4em] text-amber-bright/80">
        Select all that apply
      </p>

      <div className="grid grid-cols-2 gap-[2vh]">
        {question.options.map((option, index) => {
          const isCorrect = revealed && correct.includes(index);
          const isWrong = revealed && !correct.includes(index);
          const count = state.optionCounts[index] ?? 0;

          return (
            <div
              key={index}
              className={`relative flex items-center gap-[1.6vw] overflow-hidden rounded-[1.6vh] border-[0.35vh] px-[2vw] py-[2.4vh] transition-all duration-700 ${
                isCorrect
                  ? "scale-[1.03] border-emerald-400 bg-emerald-400/20 shadow-[0_0_50px_rgba(52,211,153,0.5)]"
                  : isWrong
                    ? "border-white/10 bg-white/[0.02] opacity-45"
                    : "border-cyan-400/30 bg-cyan-400/[0.07]"
              }`}
            >
              {revealed && (
                <div
                  className={`absolute inset-y-0 left-0 transition-[width] duration-[900ms] ease-out ${
                    isCorrect ? "bg-emerald-400/20" : "bg-white/[0.04]"
                  }`}
                  style={{ width: `${(count / maxCount) * 100}%` }}
                />
              )}

              <span
                className={`relative flex h-[7vh] w-[7vh] shrink-0 items-center justify-center rounded-[1.2vh] text-[3.2vh] font-black ${
                  isCorrect ? "bg-emerald-400 text-abyss" : "bg-white/10 text-cyan-200"
                }`}
              >
                {isCorrect ? "✓" : LETTERS[index]}
              </span>

              <span className="relative min-w-0 flex-1 text-[3vh] font-bold leading-tight">
                {option}
              </span>

              {revealed && (
                <span className="relative shrink-0 font-mono text-[2.4vh] font-bold tabular-nums text-slate-300">
                  {count}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pixel reveal
// ---------------------------------------------------------------------------

function PixelStage({ state }: { state: ScreenView }) {
  const question = state.question;
  if (!question || question.type !== "pixel") return null;
  const revealed = state.revealed && typeof question.correctIndex === "number";

  return (
    <div className="flex h-full items-center justify-center gap-[3vw]">
      <div className="h-full min-h-0 flex-1">
        <PixelBoard image={question.image} stage={state.pixelStage} revealed={state.revealed} />
      </div>

      <div className="flex w-[22vw] shrink-0 flex-col gap-[2vh]">
        <StagePoints stagePoints={question.stagePoints} stage={state.pixelStage} />

        {revealed && (
          <div className="animate-pop-in rounded-[1.2vh] border-[0.35vh] border-emerald-400 bg-emerald-400/20 px-[1.4vw] py-[1.6vh] text-center">
            <p className="font-mono text-[1.5vh] uppercase tracking-[0.3em] text-emerald-300/80">
              Answer
            </p>
            <p className="text-[3.2vh] font-black text-emerald-300">
              {question.options[question.correctIndex as number]}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Slider / bet
// ---------------------------------------------------------------------------

function SliderStage({ state }: { state: ScreenView }) {
  const question = state.question;
  if (!question || !isNumericPrompt(question)) return null;

  return (
    <div className="flex h-full flex-col justify-center">
      <Histogram
        buckets={state.histogram}
        min={question.min}
        max={question.max}
        unit={question.unit}
        thousands={question.thousands ?? true}
        trueAnswer={state.revealed ? question.answer : undefined}
        answerCount={state.answerCount}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Range band
// ---------------------------------------------------------------------------

function RangeStage({ state }: { state: ScreenView }) {
  const question = state.question;
  if (!question || question.type !== "range") return null;

  return (
    <div className="flex h-full flex-col justify-center">
      <RangeChart
        buckets={state.histogram}
        min={question.min}
        max={question.max}
        unit={question.unit}
        thousands={question.thousands ?? true}
        trueMin={state.revealed ? question.answerMin : undefined}
        trueMax={state.revealed ? question.answerMax : undefined}
        answerCount={state.answerCount}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Heatmap
// ---------------------------------------------------------------------------

function HeatmapStage({ state }: { state: ScreenView }) {
  const question = state.question;
  if (!question || question.type !== "heatmap") return null;

  return (
    <div className="flex h-full items-center justify-center gap-[2.5vw]">
      <div className="h-full min-h-0">
        <HeatmapBoard
          image={question.image}
          revealImage={question.revealImage}
          aspect={question.aspect}
          taps={state.taps}
          trueAnswer={state.revealed ? question.answer : undefined}
          sweeping={state.phase === "question"}
        />
      </div>

      <div className="flex w-[16vw] shrink-0 flex-col gap-[1.2vh]">
        <Stat label="Pins dropped" value={formatNumber(state.taps.length)} />
        {state.revealed && (
          <p className="animate-fade-up text-[2vh] leading-relaxed text-amber-bright/90">
            The star marks the crest. Closest pins score highest.
          </p>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1.2vh] border border-white/12 bg-white/[0.04] px-[1.2vw] py-[1.4vh]">
      <p className="font-mono text-[1.3vh] uppercase tracking-[0.25em] text-cyan-300/60">
        {label}
      </p>
      <p className="text-[3.4vh] font-black tabular-nums text-slate-100">{value}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Betting window (question still hidden)
// ---------------------------------------------------------------------------

export function BettingStage({ state }: { state: ScreenView }) {
  const question = state.question;
  const intro =
    question?.type === "bet" && question.intro
      ? question.intro
      : {
          headline: "DOUBLE OR LOSE",
          subline: "You have reached a decision point.",
          safeLabel: "KEEP YOUR POINTS",
          riskLabel: "BET EVERYTHING",
        };

  const everyoneIn = state.playerCount > 0 && state.betCount >= state.playerCount;

  return (
    <div className="flex h-full flex-col items-center justify-center text-center">
      {/* Warning bar */}
      <div className="flex animate-pop-in items-center gap-[1.2vw] rounded-full border-[0.3vh] border-rose-500/70 bg-rose-500/15 px-[2.4vw] py-[1vh]">
        <span className="text-[3vh]">⚠️</span>
        <span className="font-mono text-[2vh] font-bold uppercase tracking-[0.45em] text-rose-300">
          Final round
        </span>
      </div>

      <h1 className="mt-[2.4vh] animate-pop-in text-[10vh] font-black leading-none tracking-tight text-glow-amber text-amber-bright">
        {intro.headline}
      </h1>

      <p className="mt-[1.6vh] text-[3.4vh] font-semibold text-slate-300">
        {intro.subline}
      </p>

      {/* The two paths, set against each other. */}
      <div className="mt-[5vh] flex items-stretch gap-[2.5vw]">
        <ChoicePanel label={intro.safeLabel} tone="safe" />
        <div className="flex items-center">
          <span className="font-mono text-[2.6vh] uppercase tracking-[0.4em] text-slate-500">
            or
          </span>
        </div>
        <ChoicePanel label={intro.riskLabel} tone="risk" />
      </div>

      {/* Wager counter */}
      <div className="mt-[5vh] flex items-baseline gap-[1.2vw]">
        <span
          className={`text-[9vh] font-black tabular-nums leading-none ${
            everyoneIn ? "text-emerald-400" : "text-amber-bright text-glow-amber"
          }`}
        >
          {state.betCount}
        </span>
        <span className="text-[3.4vh] font-bold text-slate-400">
          / {state.playerCount} wagers placed
        </span>
      </div>

      {everyoneIn && (
        <p className="mt-[1vh] animate-fade-up font-mono text-[1.9vh] uppercase tracking-[0.35em] text-emerald-400">
          All bets are in
        </p>
      )}
    </div>
  );
}

/** One of the two paths on the decision slide. */
function ChoicePanel({ label, tone }: { label: string; tone: "safe" | "risk" }) {
  const safe = tone === "safe";
  return (
    <div
      className={`flex min-w-[24vw] items-center justify-center rounded-[1.6vh] border-[0.35vh] px-[2.4vw] py-[3vh] ${
        safe
          ? "border-cyan-400/50 bg-cyan-400/10"
          : "animate-pulse-ring border-orange-500/70 bg-orange-500/15"
      }`}
    >
      <span
        className={`text-[3.4vh] font-black leading-tight tracking-tight ${
          safe ? "text-cyan-200" : "text-orange-300"
        }`}
      >
        {label}
      </span>
    </div>
  );
}


/** Shown between locking answers and revealing them. */
export function LockedStage({ state }: { state: ScreenView }) {
  return (
    <div className="flex h-full flex-col items-center justify-center text-center">
      <h1 className="text-[9vh] font-black leading-none text-glow">Answers locked</h1>
      <p className="mt-[3vh] font-mono text-[2.6vh] uppercase tracking-[0.4em] text-cyan-300/70">
        {formatNumber(state.answerCount)} of {formatNumber(state.playerCount)} answered
      </p>
    </div>
  );
}

/** Winner banner for the final screen. Confetti is fired by the parent. */
export function FinishedStage({ state }: { state: ScreenView }) {
  const winner = state.winner;
  if (!winner) {
    return (
      <div className="flex flex-col items-center py-[6vh]">
        <h1 className="text-[6vh] font-black text-glow">Nobody played!</h1>
        <p className="mt-[2vh] text-[2.6vh] text-slate-400">
          Hit Reset on the control panel and run it again.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center">
      <p className="font-mono text-[1.9vh] uppercase tracking-[0.55em] text-amber-bright/80">
        TD {formatNumber(state.maxDepth)} m — winner
      </p>
      <h1 className="mt-[1vh] animate-pop-in text-[8.5vh] font-black leading-none text-amber-bright text-glow-amber">
        {winner.name}
      </h1>
      <p className="text-[3.4vh] font-black tabular-nums text-slate-200">
        {formatNumber(winner.score)} pts
      </p>
    </div>
  );
}
