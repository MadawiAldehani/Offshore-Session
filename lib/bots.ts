/**
 * Simulated players.
 * ---------------------------------------------------------------------------
 * The "Simulate players" button spawns bots that join the lobby and answer
 * every question like a real audience would. This is what lets you run the
 * whole demo solo.
 *
 * The goal is not random answers — random answers make a flat, ugly histogram.
 * The goal is *plausible* answers:
 *
 *  - most people know roughly the right ballpark, a few are wildly off
 *  - people systematically under-estimate big numbers
 *  - answers trickle in over the window rather than arriving all at once
 *  - on the pixel reveal, early guessers are less likely to be right
 *
 * That produces bell-shaped histograms, believable heatmap clusters and a
 * leaderboard that actually moves around between rounds.
 */

import { QUESTIONS } from "./questions";
import type { MemoryStore } from "./store/memory";
import type { GameState, Question } from "./types";
import type { Result } from "./store/types";
import { ok } from "./store/types";

// ---------------------------------------------------------------------------
// Names — a plausible cross-section of a company workshop
// ---------------------------------------------------------------------------

const FIRST_NAMES = [
  "Ana", "Mateus", "Sofia", "Lars", "Ingrid", "Tobias", "Camila", "Rafael",
  "Nina", "Ahmed", "Yara", "Kwame", "Amara", "Diego", "Elena", "Johan",
  "Priya", "Rohan", "Mei", "Hiro", "Astrid", "Kasper", "Freya", "Olek",
  "Bianca", "Tomas", "Leila", "Sven", "Marta", "Idris", "Noor", "Pieter",
  "Aisha", "Emeka", "Sara", "Nikolai", "Greta", "Felipe", "Ravi", "Hanne",
  "Bruno", "Claudia", "Erik", "Fatima", "Gabriel", "Helena", "Ivan", "Jana",
  "Karim", "Lucia", "Magnus", "Oksana", "Paulo", "Rania", "Stefan", "Tanya",
  "Umar", "Vera", "Wouter", "Zoe", "Anders", "Beatriz", "Cato", "Dmitri",
];

const LAST_INITIALS = "ABCDEHJKLMNPRSTVW".split("");

function botName(index: number): string {
  const first = FIRST_NAMES[index % FIRST_NAMES.length];
  const initial = LAST_INITIALS[Math.floor(index / FIRST_NAMES.length) % LAST_INITIALS.length];
  // A few people just use a first name, like they would in real life.
  return index % 5 === 0 ? first : `${first} ${initial}.`;
}

// ---------------------------------------------------------------------------
// Randomness helpers
// ---------------------------------------------------------------------------

/** Standard normal via Box–Muller. */
function gaussian(): number {
  let u = 0;
  let v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

function snapToStep(value: number, min: number, step: number): number {
  if (step <= 0) return value;
  return min + Math.round((value - min) / step) * step;
}

/**
 * When in the answer window a given bot responds, in ms.
 * Skewed early with a long tail — the shape of a real room answering.
 */
function responseDelay(timeLimitSec: number): number {
  const windowMs = timeLimitSec * 1000;
  const fraction = 0.08 + 0.78 * Math.pow(Math.random(), 1.7);
  return Math.round(windowMs * fraction);
}

// ---------------------------------------------------------------------------
// Per-question-type answer generation
// ---------------------------------------------------------------------------

/** Probability a bot picks the right MCQ option. */
const MCQ_ACCURACY = 0.62;

/**
 * Multi-select behaviour. Real rooms split three ways on these: most people
 * find the full set, a good number stop at one correct answer, and a few
 * over-select and drag in a wrong option.
 */
const MULTI_FULLY_CORRECT = 0.45;
const MULTI_PARTIAL = 0.3;

/** Odds a pixel-reveal bot is correct, indexed by the stage it answers at. */
const PIXEL_ACCURACY_BY_STAGE = [0.35, 0.55, 0.78, 0.9];

function pickMCQOption(question: { options: string[]; correctIndex: number }): number {
  if (Math.random() < MCQ_ACCURACY) return question.correctIndex;
  const wrong = question.options
    .map((_, i) => i)
    .filter((i) => i !== question.correctIndex);
  return wrong[Math.floor(Math.random() * wrong.length)];
}

/** A believable set of picks for a multiple-response question. */
function pickMultiOptions(question: {
  options: string[];
  correctIndexes: number[];
}): number[] {
  const correct = question.correctIndexes;
  const wrong = question.options
    .map((_, i) => i)
    .filter((i) => !correct.includes(i));
  const roll = Math.random();

  // Got the whole set.
  if (roll < MULTI_FULLY_CORRECT) return [...correct];

  // Found some of it but stopped early.
  if (roll < MULTI_FULLY_CORRECT + MULTI_PARTIAL) {
    const keep = Math.max(1, Math.floor(Math.random() * correct.length) || 1);
    return shuffle([...correct]).slice(0, keep);
  }

  // Over-selected: the right ones plus a distractor.
  if (wrong.length > 0 && Math.random() < 0.6) {
    return [...correct, wrong[Math.floor(Math.random() * wrong.length)]];
  }

  // Genuinely guessing.
  const pool = shuffle([...correct, ...wrong]);
  return pool.slice(0, Math.max(1, Math.floor(Math.random() * pool.length) || 1));
}

function shuffle<T>(items: T[]): T[] {
  for (let i = items.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

/**
 * A believable numeric guess: a tight cluster of informed answers, a looser
 * band of rough guesses, and a slight collective under-estimate.
 */
function guessNumeric(question: {
  min: number;
  max: number;
  step: number;
  answer: number;
}): number {
  const range = question.max - question.min;
  const informed = Math.random() < 0.7;
  const sigma = range * (informed ? 0.09 : 0.26);
  // Crowds under-shoot large unfamiliar numbers more often than they overshoot.
  const bias = -range * 0.035;
  const raw = question.answer + bias + gaussian() * sigma;
  return snapToStep(clamp(raw, question.min, question.max), question.min, question.step);
}

/**
 * A believable band. Most people anchor the low end at (or near) zero because
 * a coastline is zero depth, and the spread is all in where they put the top.
 */
function guessRange(question: {
  min: number;
  max: number;
  step: number;
  answerMin: number;
  answerMax: number;
}): { low: number; high: number } {
  const span = question.answerMax - question.answerMin;
  const roll = Math.random();

  let low: number;
  let high: number;
  if (roll < 0.6) {
    // Close: anchored low, top near the truth.
    low = question.answerMin + Math.abs(gaussian()) * span * 0.12;
    high = question.answerMax + gaussian() * span * 0.35;
  } else if (roll < 0.85) {
    // Too wide — the cautious "cover everything" answer.
    low = question.answerMin + Math.abs(gaussian()) * span * 0.2;
    high = question.answerMax + Math.abs(gaussian()) * span * 1.1;
  } else {
    // Genuinely guessing, often far too deep.
    low = question.min + Math.random() * (question.max - question.min) * 0.5;
    high = low + Math.random() * (question.max - low);
  }

  const snap = (v: number) =>
    snapToStep(clamp(v, question.min, question.max), question.min, question.step);
  const a = snap(low);
  const b = snap(high);
  return { low: Math.min(a, b), high: Math.max(a, b) };
}

function guessHeatmap(answer: { x: number; y: number }): { x: number; y: number } {
  // 80% aim at the structure, 20% are guessing across the map.
  if (Math.random() < 0.8) {
    return {
      x: clamp(answer.x + gaussian() * 0.065, 0.02, 0.98),
      y: clamp(answer.y + gaussian() * 0.06, 0.02, 0.98),
    };
  }
  return { x: clamp(0.5 + gaussian() * 0.26, 0.02, 0.98), y: clamp(0.5 + gaussian() * 0.22, 0.02, 0.98) };
}

/** Which reveal stage a bot commits at — later stages are more popular. */
function pickPixelStage(stageCount: number): number {
  const weights = [0.18, 0.28, 0.32, 0.22].slice(0, stageCount);
  const total = weights.reduce((a, b) => a + b, 0);
  let roll = Math.random() * total;
  for (let i = 0; i < weights.length; i += 1) {
    roll -= weights[i];
    if (roll <= 0) return i;
  }
  return stageCount - 1;
}

/** Bettors are a mix of cautious, typical and all-in. */
function chooseWager(score: number): number {
  if (score <= 0) return 0;
  const roll = Math.random();
  if (roll < 0.12) return score; // all in
  if (roll < 0.3) return Math.round(score * (0.6 + Math.random() * 0.3));
  if (roll < 0.8) return Math.round(score * (0.2 + Math.random() * 0.35));
  return Math.round(score * Math.random() * 0.2); // playing it safe
}

// ---------------------------------------------------------------------------
// Driver
// ---------------------------------------------------------------------------

/**
 * Schedule every bot's response to the question that just opened.
 * Called on each question open (and immediately when bots are spawned into an
 * already-running question, so late arrivals still take part).
 */
function scheduleAnswers(store: MemoryStore, state: GameState, question: Question): void {
  const bots = Object.values(state.players).filter((p) => p.isBot);
  if (bots.length === 0) return;

  // --- Betting window: place wagers, question not yet visible ---------------
  if (state.phase === "betting" && question.type === "bet") {
    for (const bot of bots) {
      const delay = responseDelay(question.betTimeLimit) * 0.8;
      const timer = setTimeout(() => {
        void store.placeBet(bot.id, question.id, chooseWager(bot.score));
      }, delay);
      store.trackTimer(timer);
    }
    return;
  }

  if (state.phase !== "question") return;

  for (const bot of bots) {
    if (question.type === "pixel") {
      // Pixel bots commit at a chosen stage rather than a random moment.
      const stage = pickPixelStage(question.stagePoints.length);
      const jitter = Math.random() * question.stageDuration * 900;
      const delay = stage * question.stageDuration * 1000 + 250 + jitter;
      const accuracy = PIXEL_ACCURACY_BY_STAGE[stage] ?? 0.8;
      const correct = Math.random() < accuracy;
      const optionIndex = correct
        ? question.correctIndex
        : pickWrongOption(question.options.length, question.correctIndex);
      const timer = setTimeout(() => {
        void store.submitAnswer(bot.id, question.id, { optionIndex });
      }, delay);
      store.trackTimer(timer);
      continue;
    }

    const delay = responseDelay(question.timeLimit);
    const timer = setTimeout(() => {
      switch (question.type) {
        case "mcq":
          void store.submitAnswer(bot.id, question.id, {
            optionIndex: pickMCQOption(question),
          });
          break;
        case "multi":
          void store.submitAnswer(bot.id, question.id, {
            optionIndexes: pickMultiOptions(question),
          });
          break;
        case "slider":
          void store.submitAnswer(bot.id, question.id, { value: guessNumeric(question) });
          break;
        case "bet":
          if (question.mode === "choice") {
            void store.submitAnswer(bot.id, question.id, {
              optionIndex: pickMCQOption(question),
            });
          } else {
            void store.submitAnswer(bot.id, question.id, { value: guessNumeric(question) });
          }
          break;
        case "range":
          void store.submitAnswer(bot.id, question.id, guessRange(question));
          break;
        case "heatmap":
          void store.submitAnswer(bot.id, question.id, guessHeatmap(question.answer));
          break;
      }
    }, delay);
    store.trackTimer(timer);
  }
}

function pickWrongOption(optionCount: number, correctIndex: number): number {
  const wrong = Array.from({ length: optionCount }, (_, i) => i).filter(
    (i) => i !== correctIndex,
  );
  return wrong[Math.floor(Math.random() * wrong.length)];
}

/**
 * Spawn `count` bots. They join over a couple of seconds rather than all at
 * once, so the lobby counter visibly ticks up on the projector.
 */
export async function makeBots(store: MemoryStore, count: number): Promise<Result> {
  // Install the hook once; it drives bot answers for the rest of the game.
  store.onQuestionOpen = (state) => {
    const question = state.questionIndex >= 0 ? questionFromState(state) : null;
    if (question) scheduleAnswers(store, state, question);
  };

  const existing = Object.values(store.getState().players).filter((p) => p.isBot).length;

  for (let i = 0; i < count; i += 1) {
    const delay = Math.round((i / count) * 2200 + Math.random() * 180);
    const timer = setTimeout(() => {
      store.addPlayer(botName(existing + i), true);
    }, delay);
    store.trackTimer(timer);
  }

  // If a question is already running, let the new arrivals play it too.
  const state = store.getState();
  if (state.phase === "question" || state.phase === "betting") {
    const timer = setTimeout(() => {
      const current = store.getState();
      const question = questionFromState(current);
      if (question) scheduleAnswers(store, current, question);
    }, 2500);
    store.trackTimer(timer);
  }

  return ok;
}

/** Resolve the live question from a state snapshot. */
function questionFromState(state: GameState): Question | null {
  return QUESTIONS[state.questionIndex] ?? null;
}
