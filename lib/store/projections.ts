/**
 * View projections.
 * ---------------------------------------------------------------------------
 * The raw GameState holds every answer and every correct answer. None of the
 * three views should receive all of it:
 *
 *  - phones must not be able to read the correct answer out of devtools
 *    before the reveal (this is the whole game),
 *  - the projector needs aggregates (histogram buckets, tap coordinates,
 *    counts), not 200 individual answer records,
 *  - the admin panel needs roster and control metadata.
 *
 * So each SSE connection re-projects the state for its own view. That also
 * keeps payloads small: the projector gets ~24 histogram buckets instead of
 * 200 answers.
 */

import { QUESTIONS, TOTAL_DEPTH_M } from "../questions";
import type {
  AdminView,
  Player,
  Answer,
  CommonView,
  GameState,
  HistogramBucket,
  LeaderboardRow,
  PlayView,
  PublicQuestion,
  Question,
  ScreenView,
} from "../types";
import { compareForRank, depthForIndex } from "./memory";

const HISTOGRAM_BUCKETS = 24;

// ---------------------------------------------------------------------------
// Per-state memoisation
// ---------------------------------------------------------------------------
//
// Every connected client projects the state for itself. With 200 phones open
// that meant sorting 200 players 200 times per broadcast, plus rebuilding the
// same histogram and leaderboard for each one.
//
// The state object is replaced immutably on every change, so it is a safe
// cache key: a new object means genuinely new data. A WeakMap lets old states
// be garbage collected as soon as nothing references them.

interface Derived {
  /** Players sorted into ranking order — the expensive part. */
  ranked: Player[];
  rankOf: Map<string, number>;
  leaderboard: LeaderboardRow[];
  histogram: HistogramBucket[];
  taps: { x: number; y: number }[];
  optionCounts: number[];
  screen?: ScreenView;
  admin?: AdminView;
}

const derivedCache = new WeakMap<GameState, Derived>();

function derive(state: GameState): Derived {
  const cached = derivedCache.get(state);
  if (cached) return cached;

  const question = currentQuestion(state);
  const ranked = Object.values(state.players).sort(compareForRank);
  const rankOf = new Map(ranked.map((p, i) => [p.id, i + 1]));
  const leaderboard = ranked.map((player, index) => ({
    playerId: player.id,
    name: player.name,
    score: player.score,
    delta: player.score - player.previousScore,
    rank: index + 1,
    previousRank: player.previousRank,
  }));

  const derived: Derived = {
    ranked,
    rankOf,
    leaderboard,
    histogram: buildHistogram(state, question),
    taps: buildTaps(state, question),
    optionCounts: buildOptionCounts(state, question),
  };
  derivedCache.set(state, derived);
  return derived;
}

/** Phases in which the correct answer may be shown to clients. */
function isRevealed(state: GameState, question: Question | null): boolean {
  if (!question) return false;
  return state.scored.includes(question.id);
}

/**
 * Strip answer-bearing fields from a question unless the reveal has happened.
 * This is the security boundary between "the quiz" and "view source".
 */
function publicQuestion(question: Question | null, revealed: boolean): PublicQuestion | null {
  if (!question) return null;

  switch (question.type) {
    case "mcq": {
      const { correctIndex, ...rest } = question;
      return revealed ? { ...rest, correctIndex } : rest;
    }
    case "multi": {
      const { correctIndexes, ...rest } = question;
      return revealed ? { ...rest, correctIndexes } : rest;
    }
    case "pixel": {
      const { correctIndex, ...rest } = question;
      return revealed ? { ...rest, correctIndex } : rest;
    }
    case "slider": {
      const { answer, ...rest } = question;
      return revealed ? { ...rest, answer } : rest;
    }
    case "bet": {
      if (question.mode === "choice") {
        const { correctIndex, ...rest } = question;
        return revealed ? { ...rest, correctIndex } : rest;
      }
      const { answer, ...rest } = question;
      return revealed ? { ...rest, answer } : rest;
    }
    case "range": {
      const { answerMin, answerMax, ...rest } = question;
      return revealed ? { ...rest, answerMin, answerMax } : rest;
    }
    case "heatmap": {
      const { answer, ...rest } = question;
      return revealed ? { ...rest, answer } : rest;
    }
  }
}

function currentQuestion(state: GameState): Question | null {
  return QUESTIONS[state.questionIndex] ?? null;
}

function answersFor(state: GameState, question: Question | null): Record<string, Answer> {
  if (!question) return {};
  return state.answers[question.id] ?? {};
}

function commonView(state: GameState): CommonView {
  const question = currentQuestion(state);
  const revealed = isRevealed(state, question);
  return {
    phase: state.phase,
    questionIndex: state.questionIndex,
    questionCount: QUESTIONS.length,
    question: publicQuestion(question, revealed),
    startedAt: state.startedAt,
    endsAt: state.endsAt,
    serverNow: Date.now(),
    playerCount: Object.keys(state.players).length,
    answerCount: Object.keys(answersFor(state, question)).length,
    pixelStage: state.pixelStage,
    muted: state.muted,
    revealed,
    depth: depthForIndex(state.questionIndex, state.phase),
    maxDepth: TOTAL_DEPTH_M,
  };
}

export function buildLeaderboard(state: GameState, limit?: number): LeaderboardRow[] {
  const rows = derive(state).leaderboard;
  return typeof limit === "number" ? rows.slice(0, limit) : rows;
}

/**
 * Bucket numeric guesses for the projector histogram. Always returns the full
 * set of buckets (including empty ones) so the chart keeps a stable x-axis as
 * answers stream in.
 */
export function buildHistogram(
  state: GameState,
  question: Question | null,
): HistogramBucket[] {
  if (!question) return [];
  const numericBet = question.type === "bet" && question.mode === "numeric";
  if (question.type !== "slider" && question.type !== "range" && !numericBet) return [];
  // Narrowed above; every remaining shape carries min/max.
  const { min, max } = question as { min: number; max: number };
  const width = (max - min) / HISTOGRAM_BUCKETS;
  const buckets: HistogramBucket[] = Array.from({ length: HISTOGRAM_BUCKETS }, (_, i) => ({
    from: min + i * width,
    to: min + (i + 1) * width,
    count: 0,
  }));

  for (const answer of Object.values(answersFor(state, question))) {
    if (question.type === "range") {
      // A band contributes to EVERY bucket it covers, building a coverage
      // profile: the peak is where the room agrees the answer lies.
      if (typeof answer.low !== "number" || typeof answer.high !== "number") continue;
      const lo = Math.min(answer.low, answer.high);
      const hi = Math.max(answer.low, answer.high);
      for (const [index, bucket] of buckets.entries()) {
        if (hi > bucket.from && lo < bucket.to) buckets[index].count += 1;
      }
      continue;
    }
    if (typeof answer.value !== "number") continue;
    const offset = (answer.value - min) / width;
    // The top-of-range guess belongs in the last bucket, not a 25th one.
    const index = Math.min(HISTOGRAM_BUCKETS - 1, Math.max(0, Math.floor(offset)));
    buckets[index].count += 1;
  }
  return buckets;
}

function buildTaps(state: GameState, question: Question | null): { x: number; y: number }[] {
  if (!question || question.type !== "heatmap") return [];
  return Object.values(answersFor(state, question))
    .filter((a) => typeof a.x === "number" && typeof a.y === "number")
    .map((a) => ({ x: a.x as number, y: a.y as number }));
}

/**
 * Tally of picks per option. Safe to send before the reveal: it says how the
 * room split, not which split is correct.
 */
function buildOptionCounts(state: GameState, question: Question | null): number[] {
  if (!question) return [];
  const choiceBet = question.type === "bet" && question.mode === "choice";
  if (
    question.type !== "mcq" &&
    question.type !== "multi" &&
    question.type !== "pixel" &&
    !choiceBet
  )
    return [];
  const counts = new Array((question as { options: string[] }).options.length).fill(0);
  for (const answer of Object.values(answersFor(state, question))) {
    // Multi-select contributes one tally per option the player picked, so the
    // counts can legitimately sum to more than the number of players.
    if (Array.isArray(answer.optionIndexes)) {
      for (const index of answer.optionIndexes) {
        if (counts[index] !== undefined) counts[index] += 1;
      }
    } else if (
      typeof answer.optionIndex === "number" &&
      counts[answer.optionIndex] !== undefined
    ) {
      counts[answer.optionIndex] += 1;
    }
  }
  return counts;
}

function betCount(state: GameState, question: Question | null): number {
  if (!question || question.type !== "bet") return 0;
  return Object.keys(state.bets[question.id] ?? {}).length;
}

// ---------------------------------------------------------------------------
// The three public projections
// ---------------------------------------------------------------------------

export function projectScreen(state: GameState): ScreenView {
  const d = derive(state);
  // serverNow must be the real current time — clients derive their clock
  // offset from it — so it is refreshed even when the rest is cached.
  if (d.screen) return { ...d.screen, serverNow: Date.now() };

  const leaderboard = d.leaderboard;
  const view: ScreenView = {
    ...commonView(state),
    view: "screen",
    recentPlayers: Object.values(state.players)
      .sort((a, b) => b.joinedAt - a.joinedAt)
      .slice(0, 60)
      .map((p) => ({ id: p.id, name: p.name })),
    leaderboard: leaderboard.slice(0, 10),
    histogram: d.histogram,
    taps: d.taps,
    optionCounts: d.optionCounts,
    betCount: betCount(state, currentQuestion(state)),
    celebrateNonce: state.celebrateNonce,
    winner: leaderboard[0] ?? null,
  };
  d.screen = view;
  return view;
}

export function projectPlay(state: GameState, playerId: string | null): PlayView {
  const question = currentQuestion(state);
  const player = playerId ? state.players[playerId] : null;
  const myAnswer = player ? (answersFor(state, question)[player.id] ?? null) : null;
  const myBet =
    player && question?.type === "bet"
      ? (state.bets[question.id]?.[player.id] ?? null)
      : null;

  // Reuses the ranking computed once for this state, rather than re-sorting
  // every player list for each of a few hundred connected phones.
  const rank = player ? (derive(state).rankOf.get(player.id) ?? 0) : 0;

  return {
    ...commonView(state),
    view: "play",
    me: player
      ? {
          id: player.id,
          name: player.name,
          score: player.score,
          rank,
          lastDelta: player.score - player.previousScore,
        }
      : null,
    myAnswer,
    myBet,
    lockedOut: myAnswer?.lockedOut === true,
  };
}

export function projectAdmin(state: GameState): AdminView {
  const d = derive(state);
  if (d.admin) return { ...d.admin, serverNow: Date.now() };

  const question = currentQuestion(state);
  const players = d.ranked;
  const view: AdminView = {
    ...commonView(state),
    view: "admin",
    players: players.map((p) => ({
      id: p.id,
      name: p.name,
      score: p.score,
      isBot: p.isBot,
    })),
    leaderboard: d.leaderboard.slice(0, 10),
    betCount: betCount(state, question),
    botCount: players.filter((p) => p.isBot).length,
    questions: QUESTIONS.map((q) => ({ id: q.id, type: q.type, prompt: q.prompt })),
  };
  d.admin = view;
  return view;
}
