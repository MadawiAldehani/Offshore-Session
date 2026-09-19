/**
 * Core domain types for the Offshore quiz.
 *
 * These are shared by the server store, the SSE projections and every client
 * view. Keep them free of React/Next imports so they can be used anywhere.
 */

// ---------------------------------------------------------------------------
// Questions
// ---------------------------------------------------------------------------

export type QuestionType =
  | "mcq"
  | "multi"
  | "slider"
  | "range"
  | "heatmap"
  | "pixel"
  | "bet";

/** Fields every question shares. */
interface BaseQuestion {
  id: string;
  /** The prompt shown on the projector (and, smaller, on phones). */
  prompt: string;
  /** Seconds players get to answer once the question starts. */
  timeLimit: number;
  /** Optional one-liner shown on the reveal screen — the "did you know". */
  factoid?: string;
}

/** Classic 4-option multiple choice. */
export interface MCQQuestion extends BaseQuestion {
  type: "mcq";
  options: string[];
  /** Index into `options` of the correct answer. */
  correctIndex: number;
}

/**
 * Multiple-response: more than one option is correct and the player picks a
 * set, then submits. Scored with partial credit — see lib/scoring.ts.
 */
export interface MultiQuestion extends BaseQuestion {
  type: "multi";
  options: string[];
  /** Every index that counts as correct. Order does not matter. */
  correctIndexes: number[];
}

/** Numeric guess on a slider; projector draws a live histogram. */
export interface SliderQuestion extends BaseQuestion {
  type: "slider";
  min: number;
  max: number;
  /** Slider granularity. */
  step: number;
  /** Unit suffix rendered next to the value, e.g. "m" or "USD". */
  unit: string;
  answer: number;
  /** Set true to render values as 1,200,000 style. Defaults to true. */
  thousands?: boolean;
}

/**
 * Pick a BAND rather than a point: players choose a low and a high value and
 * are scored on how well their band overlaps the true one.
 */
export interface RangeQuestion extends BaseQuestion {
  type: "range";
  /** Slider bounds (not the answer). */
  min: number;
  max: number;
  step: number;
  unit: string;
  /** The true band. */
  answerMin: number;
  answerMax: number;
  thousands?: boolean;
}

/** Tap-a-location-on-an-image question. Coordinates are normalised 0..1. */
export interface HeatmapQuestion extends BaseQuestion {
  type: "heatmap";
  /**
   * Either a built-in SVG name ("contour") or a path under /public
   * (e.g. "/maps/kuwait-clean.png").
   */
  image: string;
  /**
   * Optional second image swapped in ONLY after the reveal — use it when the
   * annotated version of a map would give the answer away during play.
   * Falls back to `image`.
   */
  revealImage?: string;
  /**
   * Image aspect ratio (width ÷ height). Must match the artwork or taps will
   * land in the wrong place. Defaults to 4/3.
   */
  aspect?: number;
  answer: { x: number; y: number };
  /**
   * Distance (in normalised units) beyond which a tap scores zero.
   * 0.5 means "half the image width away = no points".
   */
  tolerance: number;
}

/** Image de-pixelates in stages; answering earlier is worth more. */
export interface PixelQuestion extends BaseQuestion {
  type: "pixel";
  image: "jackup";
  options: string[];
  correctIndex: number;
  /** Points awarded per stage index. Length defines the number of stages. */
  stagePoints: number[];
  /** Seconds between sharpening steps. */
  stageDuration: number;
}

/**
 * Copy for the dramatic slide shown while wagers are open, before the question
 * itself is revealed. Purely presentational — edit it in questions.ts.
 */
export interface BetIntro {
  /** Big line, e.g. "DOUBLE OR LOSE". */
  headline: string;
  /** Supporting line under it. */
  subline: string;
  /** The two contrasting choices, shown side by side. */
  safeLabel: string;
  riskLabel: string;
}

interface BetBase extends BaseQuestion {
  type: "bet";
  /** Seconds players get to place their wager before the question appears. */
  betTimeLimit: number;
  intro?: BetIntro;
}

/**
 * Wager round answered by picking an option (YES/NO, or any short list).
 * Win the wager outright by being right — no partial credit, which is what
 * makes it a real gamble.
 */
export interface BetChoiceQuestion extends BetBase {
  mode: "choice";
  options: string[];
  correctIndex: number;
}

/** Wager round answered on a slider. Won by landing in the closest half. */
export interface BetNumericQuestion extends BetBase {
  mode: "numeric";
  min: number;
  max: number;
  step: number;
  unit: string;
  answer: number;
  thousands?: boolean;
}

export type BetQuestion = BetChoiceQuestion | BetNumericQuestion;

export type Question =
  | MCQQuestion
  | MultiQuestion
  | SliderQuestion
  | RangeQuestion
  | HeatmapQuestion
  | PixelQuestion
  | BetQuestion;

/** Questions whose answer is a number on a range (slider mechanics). */
export type NumericQuestion = SliderQuestion | BetNumericQuestion;

/** Questions answered by picking one of N options. */
export type ChoiceQuestion = MCQQuestion | MultiQuestion | PixelQuestion;

// ---------------------------------------------------------------------------
// Game state
// ---------------------------------------------------------------------------

/**
 * The phase drives what every view renders. The admin panel advances it.
 *
 *   lobby    → players joining, projector shows QR
 *   betting  → (bet question only) wagers open, question still hidden
 *   question → answers open, countdown running
 *   locked   → answers closed, suspense beat before the reveal
 *   reveal   → correct answer + score deltas shown
 *   scores   → top-10 leaderboard between questions
 *   finished → final leaderboard, winner, confetti
 */
export type Phase =
  | "lobby"
  | "betting"
  | "question"
  | "locked"
  | "reveal"
  | "scores"
  | "finished";

export interface Player {
  id: string;
  name: string;
  score: number;
  joinedAt: number;
  isBot: boolean;
  /** Score before the current question was scored — powers "+320" deltas. */
  previousScore: number;
  /** Leaderboard rank before the last re-sort — powers the move animation. */
  previousRank: number | null;
}

/** One submitted answer. Only the fields relevant to the question type are set. */
export interface Answer {
  playerId: string;
  /** Epoch ms the answer landed on the server. */
  at: number;
  /** mcq / pixel */
  optionIndex?: number;
  /** multi — the full set of options this player picked */
  optionIndexes?: number[];
  /** slider / bet */
  value?: number;
  /** range — the band the player selected */
  low?: number;
  high?: number;
  /** heatmap */
  x?: number;
  y?: number;
  /** pixel — which reveal stage was showing when they answered. */
  stage?: number;
  /** Points this answer earned, filled in at reveal time. */
  points?: number;
  /** True if a wrong pixel-reveal guess locked this player out. */
  lockedOut?: boolean;
}

/** A wager placed in the final betting round. */
export interface Bet {
  playerId: string;
  amount: number;
  at: number;
}


export interface GameState {
  phase: Phase;
  /** Index into the questions array; -1 while in the lobby. */
  questionIndex: number;
  players: Record<string, Player>;
  /** questionId → playerId → answer */
  answers: Record<string, Record<string, Answer>>;
  /** questionId → playerId → bet (only the bet question uses this) */
  bets: Record<string, Record<string, Bet>>;
  /** Epoch ms when the current question/betting window started. */
  startedAt: number | null;
  /** Epoch ms when it auto-locks. Clients render the countdown from this. */
  endsAt: number | null;
  /** Current pixel-reveal stage index. */
  pixelStage: number;
  /** Question ids already scored, so a double-reveal can't double-score. */
  scored: string[];
  /** Admin-controlled mute for the projector's countdown tick. */
  muted: boolean;
  /** Bumped whenever confetti should fire on the projector. */
  celebrateNonce: number;
}

// ---------------------------------------------------------------------------
// Client-facing projections (see lib/store/projections.ts)
// ---------------------------------------------------------------------------

export interface LeaderboardRow {
  playerId: string;
  name: string;
  score: number;
  delta: number;
  rank: number;
  previousRank: number | null;
}

/** A question with every answer-revealing field stripped out. */
export type PublicQuestion =
  | (Omit<MCQQuestion, "correctIndex"> & { correctIndex?: number })
  | (Omit<MultiQuestion, "correctIndexes"> & { correctIndexes?: number[] })
  | (Omit<SliderQuestion, "answer"> & { answer?: number })
  | (Omit<RangeQuestion, "answerMin" | "answerMax"> & {
      answerMin?: number;
      answerMax?: number;
    })
  | (Omit<HeatmapQuestion, "answer"> & { answer?: { x: number; y: number } })
  | (Omit<PixelQuestion, "correctIndex"> & { correctIndex?: number })
  | (Omit<BetChoiceQuestion, "correctIndex"> & { correctIndex?: number })
  | (Omit<BetNumericQuestion, "answer"> & { answer?: number });

export interface HistogramBucket {
  /** Lower edge of the bucket in question units. */
  from: number;
  to: number;
  count: number;
}

/** Shared by every view: the parts of the state nobody needs to hide. */
export interface CommonView {
  phase: Phase;
  questionIndex: number;
  questionCount: number;
  question: PublicQuestion | null;
  startedAt: number | null;
  endsAt: number | null;
  /** Server clock at send time, so clients can correct for drift. */
  serverNow: number;
  playerCount: number;
  answerCount: number;
  pixelStage: number;
  muted: boolean;
  /** True once the current question has been scored (i.e. answer is public). */
  revealed: boolean;
  /** Metres drilled, for the depth progress bar. */
  depth: number;
  maxDepth: number;
}

export interface ScreenView extends CommonView {
  view: "screen";
  /** Most recent joiners, newest first — the lobby ticker. */
  recentPlayers: { id: string; name: string }[];
  leaderboard: LeaderboardRow[];
  /** Slider/bet: live distribution of guesses. */
  histogram: HistogramBucket[];
  /** Heatmap: anonymous tap positions. */
  taps: { x: number; y: number }[];
  /** mcq/pixel: how many players picked each option. */
  optionCounts: number[];
  /** Number of players who placed a wager (bet phase). */
  betCount: number;
  celebrateNonce: number;
  /** Populated on `finished` — the overall winner. */
  winner: LeaderboardRow | null;
}

export interface PlayView extends CommonView {
  view: "play";
  me: {
    id: string;
    name: string;
    score: number;
    rank: number;
    /** Points earned on the question just revealed. */
    lastDelta: number;
  } | null;
  /** This player's answer to the current question, if any. */
  myAnswer: Answer | null;
  /** This player's wager in the final round, if placed. */
  myBet: Bet | null;
  /** True when a wrong pixel guess has locked them out. */
  lockedOut: boolean;
}

export interface AdminView extends CommonView {
  view: "admin";
  players: { id: string; name: string; score: number; isBot: boolean }[];
  leaderboard: LeaderboardRow[];
  betCount: number;
  botCount: number;
  /** Full question list with type badges for the control panel. */
  questions: { id: string; type: QuestionType; prompt: string }[];
}

export type ClientView = ScreenView | PlayView | AdminView;

// ---------------------------------------------------------------------------
// Narrowing helpers
// ---------------------------------------------------------------------------
//
// The bet question comes in two shapes, so "is this answered with a slider?"
// is no longer the same as "is this a slider question". These guards keep that
// distinction in one place instead of repeating the condition across the UI.

/** Public shapes answered on a numeric slider. */
export type PublicNumeric =
  | (Omit<SliderQuestion, "answer"> & { answer?: number })
  | (Omit<BetNumericQuestion, "answer"> & { answer?: number });

/** Public shapes answered by picking one option. */
export type PublicChoice =
  | (Omit<MCQQuestion, "correctIndex"> & { correctIndex?: number })
  | (Omit<PixelQuestion, "correctIndex"> & { correctIndex?: number })
  | (Omit<BetChoiceQuestion, "correctIndex"> & { correctIndex?: number });

export function isNumericPrompt(question: PublicQuestion): question is PublicNumeric {
  return (
    question.type === "slider" ||
    (question.type === "bet" && question.mode === "numeric")
  );
}

export function isChoicePrompt(question: PublicQuestion): question is PublicChoice {
  return (
    question.type === "mcq" ||
    question.type === "pixel" ||
    (question.type === "bet" && question.mode === "choice")
  );
}

/** Server-side equivalents, operating on the full Question. */
export function isNumericQuestion(
  question: Question,
): question is SliderQuestion | BetNumericQuestion {
  return (
    question.type === "slider" ||
    (question.type === "bet" && question.mode === "numeric")
  );
}

export function isChoiceQuestion(
  question: Question,
): question is MCQQuestion | PixelQuestion | BetChoiceQuestion {
  return (
    question.type === "mcq" ||
    question.type === "pixel" ||
    (question.type === "bet" && question.mode === "choice")
  );
}
