/**
 * Scoring rules — pure functions, no state. Tweak the constants here to
 * re-balance the game.
 *
 *   MCQ      1000 base × speed multiplier, floored at 500 when correct
 *   Slider   1000 × (1 − normalised distance)
 *   Heatmap  1000 × (1 − distance / tolerance)
 *   Pixel    stagePoints[stage] when correct; 0 and locked out when wrong
 *   Bet      win or lose the wager, decided by the closest-50% rule
 */

import type { Answer, BetQuestion, Question } from "./types";

export const MAX_POINTS = 1000;
/** A correct MCQ answer never scores less than this, even at the buzzer. */
export const MIN_CORRECT_POINTS = 500;

/**
 * Speed multiplier for timed questions. Linear from 1.0 at t=0 down to 0.5 at
 * the buzzer, so a correct answer is always worth at least MIN_CORRECT_POINTS.
 */
export function speedMultiplier(
  answeredAt: number,
  startedAt: number,
  timeLimitSec: number,
): number {
  const elapsed = (answeredAt - startedAt) / 1000;
  const fraction = clamp(elapsed / timeLimitSec, 0, 1);
  return 1 - fraction * 0.5;
}

export function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

/**
 * Points for a single answer. Returns 0 for anything wrong, missing or
 * out of range. `startedAt` is when the question opened.
 *
 * NOTE: the bet question is deliberately NOT handled here — its outcome
 * depends on the whole field of guesses, so it is resolved in scoreBetRound().
 */
export function scoreAnswer(
  question: Question,
  answer: Answer | undefined,
  startedAt: number,
): number {
  if (!answer) return 0;

  switch (question.type) {
    case "mcq": {
      if (answer.optionIndex !== question.correctIndex) return 0;
      const raw = MAX_POINTS * speedMultiplier(answer.at, startedAt, question.timeLimit);
      return Math.round(Math.max(MIN_CORRECT_POINTS, raw));
    }

    case "multi": {
      if (!Array.isArray(answer.optionIndexes)) return 0;
      const raw = MAX_POINTS * scoreMultiFraction(answer.optionIndexes, question.correctIndexes);
      if (raw <= 0) return 0;
      // Speed still matters, but partial credit is applied first so a fast
      // half-right answer cannot beat a slower fully-right one.
      return Math.round(raw * speedMultiplier(answer.at, startedAt, question.timeLimit));
    }

    case "slider": {
      if (typeof answer.value !== "number") return 0;
      return scoreNumeric(answer.value, question.answer, question.min, question.max);
    }

    case "range": {
      if (typeof answer.low !== "number" || typeof answer.high !== "number") return 0;
      const overlap = rangeOverlap(
        answer.low,
        answer.high,
        question.answerMin,
        question.answerMax,
      );
      if (overlap <= 0) return 0;
      return Math.round(
        MAX_POINTS * overlap * speedMultiplier(answer.at, startedAt, question.timeLimit),
      );
    }

    case "heatmap": {
      if (typeof answer.x !== "number" || typeof answer.y !== "number") return 0;
      const dx = answer.x - question.answer.x;
      const dy = answer.y - question.answer.y;
      const distance = Math.hypot(dx, dy);
      const closeness = 1 - distance / question.tolerance;
      return Math.round(MAX_POINTS * clamp(closeness, 0, 1));
    }

    case "pixel": {
      // A wrong answer already zeroed them out and set lockedOut at submit time.
      if (answer.optionIndex !== question.correctIndex) return 0;
      const stage = clamp(answer.stage ?? 0, 0, question.stagePoints.length - 1);
      return question.stagePoints[stage];
    }

    case "bet":
      return 0; // resolved by resolveBets — depends on the whole field

    default:
      return 0;
  }
}

/**
 * Partial credit for a multiple-response question, as a 0..1 fraction.
 *
 * fraction = (correct picked − incorrect picked) / (total correct)
 *
 * Subtracting the wrong picks is the important part: without it, selecting
 * every option would score full marks and the question would be pointless.
 * Selecting all four here gives (2 − 2) / 2 = 0.
 */
export function scoreMultiFraction(picked: number[], correct: number[]): number {
  if (correct.length === 0) return 0;
  const correctSet = new Set(correct);
  // De-duplicate first: a malformed client could send the same index twice.
  const unique = Array.from(new Set(picked));
  let hits = 0;
  let misses = 0;
  for (const index of unique) {
    if (correctSet.has(index)) hits += 1;
    else misses += 1;
  }
  return clamp((hits - misses) / correct.length, 0, 1);
}

/**
 * How well a guessed band matches the true one, as a 0..1 fraction.
 *
 * Intersection over union — the standard overlap measure. It is the right
 * choice here because it punishes BOTH failure modes symmetrically: a band
 * that is too narrow misses part of the answer, and a band that is too wide
 * dilutes it. Guessing the full slider range scores almost nothing.
 *
 *   true 0-40, guess 0-40   -> 40/40  = 1.00
 *   true 0-40, guess 0-80   -> 40/80  = 0.50
 *   true 0-40, guess 0-20   -> 20/40  = 0.50
 *   true 0-40, guess 60-100 ->  0/100 = 0
 */
export function rangeOverlap(
  guessLow: number,
  guessHigh: number,
  trueLow: number,
  trueHigh: number,
): number {
  // Tolerate handles arriving the wrong way round.
  const [gLo, gHi] = guessLow <= guessHigh ? [guessLow, guessHigh] : [guessHigh, guessLow];
  const [tLo, tHi] = trueLow <= trueHigh ? [trueLow, trueHigh] : [trueHigh, trueLow];

  const intersection = Math.max(0, Math.min(gHi, tHi) - Math.max(gLo, tLo));
  const union = Math.max(gHi, tHi) - Math.min(gLo, tLo);
  if (union <= 0) {
    // Both bands are zero-width: full marks only if they sit on the same value.
    return gLo === tLo ? 1 : 0;
  }
  return clamp(intersection / union, 0, 1);
}

/**
 * Closeness scoring for a numeric guess: full marks on the nose, tailing off
 * linearly to zero at the far end of the range.
 */
export function scoreNumeric(
  guess: number,
  truth: number,
  min: number,
  max: number,
): number {
  const range = max - min;
  if (range <= 0) return 0;
  // Normalise against the largest possible miss so a guess at either extreme
  // of the range still scores fairly.
  const worstMiss = Math.max(truth - min, max - truth);
  if (worstMiss <= 0) return MAX_POINTS;
  const distance = Math.abs(guess - truth);
  return Math.round(MAX_POINTS * clamp(1 - distance / worstMiss, 0, 1));
}

export interface BetOutcome {
  playerId: string;
  wager: number;
  /** Signed points change: +wager on a win, −wager on a loss. */
  delta: number;
  won: boolean;
}

/**
 * Resolve the final betting round.
 *
 * "Close enough to win" = your guess is in the closest 50% of all guesses.
 * Concretely: rank every guess by absolute distance from the truth, and the
 * better half wins. Ties at the median boundary are resolved in the player's
 * favour (generous is more fun on stage).
 *
 * Edge cases:
 *  - A player who bet but never answered loses their wager.
 *  - With a single guess, that player wins (they are trivially the closest 50%).
 *  - With zero guesses, nobody wins or loses anything.
 */
export function resolveBets(
  question: BetQuestion,
  bets: Record<string, { playerId: string; amount: number }>,
  answers: Record<string, Answer>,
): BetOutcome[] {
  const bettors = Object.values(bets);
  if (bettors.length === 0) return [];

  // --- Choice mode: right or wrong, no middle ground ----------------------
  if (question.mode === "choice") {
    return bettors.map((bet) => {
      const picked = answers[bet.playerId]?.optionIndex;
      // No answer counts as wrong: you cannot sit out a wager you placed.
      const won = picked === question.correctIndex;
      return {
        playerId: bet.playerId,
        wager: bet.amount,
        delta: won ? bet.amount : -bet.amount,
        won,
      };
    });
  }

  // --- Numeric mode: the closest half of the room wins ---------------------
  const truth = question.answer;

  // Only players who actually submitted a guess are in the running.
  const withGuess = bettors.filter(
    (b) => typeof answers[b.playerId]?.value === "number",
  );

  const distances = withGuess
    .map((b) => Math.abs((answers[b.playerId].value as number) - truth))
    .sort((a, b) => a - b);

  // The cutoff is the median distance; <= cutoff wins.
  const cutoff =
    distances.length > 0
      ? distances[Math.max(0, Math.ceil(distances.length / 2) - 1)]
      : Infinity;

  return bettors.map((bet) => {
    const guess = answers[bet.playerId]?.value;
    // No guess submitted → automatic loss.
    const won = typeof guess === "number" && Math.abs(guess - truth) <= cutoff;
    return {
      playerId: bet.playerId,
      wager: bet.amount,
      delta: won ? bet.amount : -bet.amount,
      won,
    };
  });
}
