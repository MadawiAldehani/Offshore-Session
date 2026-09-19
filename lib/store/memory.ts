/**
 * In-memory implementation of GameStore.
 * ---------------------------------------------------------------------------
 * Single-process, zero-dependency, good for a few hundred players in one room.
 * All the game rules live here; the SSE layer just observes.
 *
 * Swapping to Supabase: replace this file with one that writes to Postgres and
 * subscribes to Realtime. The interface (./types.ts) is the contract, and the
 * rule helpers it leans on (../scoring.ts) are pure, so they port unchanged.
 */

import { QUESTIONS, TOTAL_DEPTH_M, questionAt } from "../questions";
import { resolveBets, scoreAnswer } from "../scoring";
import type { Answer, GameState, Player } from "../types";
import { type AnswerInput, type GameStore, type Result, err, ok } from "./types";

function freshState(): GameState {
  return {
    phase: "lobby",
    questionIndex: -1,
    players: {},
    answers: {},
    bets: {},
    startedAt: null,
    endsAt: null,
    pixelStage: 0,
    scored: [],
    muted: false,
    celebrateNonce: 0,
  };
}

export class MemoryStore implements GameStore {
  private state: GameState = freshState();
  private listeners = new Set<(s: GameState) => void>();

  /** Pending timers, cleared on every phase change so none leak. */
  private lockTimer: ReturnType<typeof setTimeout> | null = null;
  private stageTimer: ReturnType<typeof setInterval> | null = null;
  /** Bot answer timers, tracked so reset() can cancel them all. */
  private botTimers = new Set<ReturnType<typeof setTimeout>>();
  /** Set by the bot driver in ../bots.ts — kept as a hook to avoid a cycle. */
  public onQuestionOpen: ((state: GameState) => void) | null = null;

  // -------------------------------------------------------------------------
  // Subscription plumbing
  // -------------------------------------------------------------------------

  getState(): GameState {
    return this.state;
  }

  subscribe(listener: (s: GameState) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emitScheduled = false;
  private emitTimer: ReturnType<typeof setTimeout> | null = null;
  private lastEmit = 0;

  /**
   * Minimum gap between broadcasts, in ms.
   *
   * Without this the cost is quadratic: 200 players answering means 200 state
   * changes, each fanning out to 200 connected clients — 40,000 payload
   * builds. Measured against the live deployment that pushed answer latency
   * to 35 seconds average.
   *
   * Capping the rate collapses an answer burst into a handful of broadcasts.
   * 100ms still looks instantaneous on a projector — nobody perceives a
   * tenth of a second — but it bounds the work no matter how many people
   * answer at once.
   */
  private static readonly EMIT_INTERVAL_MS = 100;

  /**
   * Notify subscribers, rate-limited.
   *
   * Leading edge fires immediately so a lone action (an admin click, one
   * player joining a quiet lobby) has no perceptible delay. Further changes
   * inside the window are coalesced into a single trailing broadcast, so no
   * update is ever dropped — only merged.
   */
  private emit(): void {
    if (this.emitScheduled) return;

    const sinceLast = Date.now() - this.lastEmit;
    if (sinceLast >= MemoryStore.EMIT_INTERVAL_MS) {
      this.lastEmit = Date.now();
      this.flush();
      return;
    }

    this.emitScheduled = true;
    this.emitTimer = setTimeout(() => {
      this.emitScheduled = false;
      this.emitTimer = null;
      this.lastEmit = Date.now();
      this.flush();
    }, MemoryStore.EMIT_INTERVAL_MS - sinceLast);
  }

  private flush(): void {
    const snapshot = this.state;
    for (const listener of this.listeners) {
      try {
        listener(snapshot);
      } catch {
        // A broken client stream must never take down the game loop.
      }
    }
  }

  /** Replace state immutably so React clients see a new object identity. */
  private patch(partial: Partial<GameState>): void {
    this.state = { ...this.state, ...partial };
    this.emit();
  }

  private clearTimers(): void {
    if (this.emitTimer) clearTimeout(this.emitTimer);
    this.emitTimer = null;
    this.emitScheduled = false;
    if (this.lockTimer) clearTimeout(this.lockTimer);
    if (this.stageTimer) clearInterval(this.stageTimer);
    this.lockTimer = null;
    this.stageTimer = null;
  }

  private clearBotTimers(): void {
    for (const t of this.botTimers) clearTimeout(t);
    this.botTimers.clear();
  }

  /** Bot driver uses this so its timers get cancelled on reset. */
  public trackTimer(t: ReturnType<typeof setTimeout>): void {
    this.botTimers.add(t);
  }

  // -------------------------------------------------------------------------
  // Player actions
  // -------------------------------------------------------------------------

  async join(rawName: string) {
    const trimmed = rawName.trim().slice(0, 20);
    if (!trimmed) return { ok: false as const, error: "Name required" };

    const name = this.uniqueName(trimmed);
    const id = randomId("p");
    const player: Player = {
      id,
      name,
      score: 0,
      joinedAt: Date.now(),
      isBot: false,
      previousScore: 0,
      previousRank: null,
    };
    this.patch({ players: { ...this.state.players, [id]: player } });
    return { ok: true as const, playerId: id, name };
  }

  /**
   * Duplicate display names get a numeric suffix: "Sam", "Sam 2", "Sam 3".
   * Comparison is case-insensitive so "sam" and "Sam" are treated as a clash.
   */
  private uniqueName(name: string): string {
    const taken = new Set(
      Object.values(this.state.players).map((p) => p.name.toLowerCase()),
    );
    if (!taken.has(name.toLowerCase())) return name;
    let n = 2;
    while (taken.has(`${name} ${n}`.toLowerCase())) n += 1;
    return `${name} ${n}`;
  }

  async rejoin(playerId: string): Promise<Result> {
    return this.state.players[playerId] ? ok : err("Unknown player");
  }

  async submitAnswer(
    playerId: string,
    questionId: string,
    input: AnswerInput,
  ): Promise<Result> {
    const player = this.state.players[playerId];
    if (!player) return err("Unknown player");
    if (this.state.phase !== "question") return err("Answers are closed");

    const question = questionAt(this.state.questionIndex);
    if (!question || question.id !== questionId) return err("Stale question");

    const existing = this.state.answers[questionId]?.[playerId];
    // One answer per player per question — except that a locked-out pixel
    // player is already finished, which we report distinctly.
    if (existing?.lockedOut) return err("Locked out of this question");
    if (existing) return err("Already answered");

    const answer: Answer = { playerId, at: Date.now() };

    switch (question.type) {
      case "mcq": {
        if (!isValidOption(input.optionIndex, question.options.length))
          return err("Invalid option");
        answer.optionIndex = input.optionIndex;
        break;
      }
      case "multi": {
        const picked = input.optionIndexes;
        if (!Array.isArray(picked) || picked.length === 0)
          return err("Pick at least one option");
        if (!picked.every((i) => isValidOption(i, question.options.length)))
          return err("Invalid option");
        // Store a de-duplicated, sorted set so the tally is stable.
        answer.optionIndexes = Array.from(new Set(picked)).sort((a, b) => a - b);
        break;
      }
      case "pixel": {
        if (!isValidOption(input.optionIndex, question.options.length))
          return err("Invalid option");
        answer.optionIndex = input.optionIndex;
        answer.stage = this.state.pixelStage;
        // A wrong guess is final: it locks the player out for the rest of the
        // question, which is what makes the early-answer gamble interesting.
        if (input.optionIndex !== question.correctIndex) answer.lockedOut = true;
        break;
      }
      case "slider": {
        if (typeof input.value !== "number" || !Number.isFinite(input.value))
          return err("Invalid value");
        answer.value = clampToRange(input.value, question.min, question.max);
        break;
      }
      case "bet": {
        // The finale comes in two shapes; validate whichever this one is.
        if (question.mode === "choice") {
          if (!isValidOption(input.optionIndex, question.options.length))
            return err("Invalid option");
          answer.optionIndex = input.optionIndex;
        } else {
          if (typeof input.value !== "number" || !Number.isFinite(input.value))
            return err("Invalid value");
          answer.value = clampToRange(input.value, question.min, question.max);
        }
        break;
      }
      case "range": {
        if (
          typeof input.low !== "number" ||
          typeof input.high !== "number" ||
          !Number.isFinite(input.low) ||
          !Number.isFinite(input.high)
        )
          return err("Invalid range");
        const lo = clampToRange(Math.min(input.low, input.high), question.min, question.max);
        const hi = clampToRange(Math.max(input.low, input.high), question.min, question.max);
        answer.low = lo;
        answer.high = hi;
        break;
      }
      case "heatmap": {
        if (
          typeof input.x !== "number" ||
          typeof input.y !== "number" ||
          !Number.isFinite(input.x) ||
          !Number.isFinite(input.y)
        )
          return err("Invalid coordinates");
        answer.x = clampToRange(input.x, 0, 1);
        answer.y = clampToRange(input.y, 0, 1);
        break;
      }
    }

    this.patch({
      answers: {
        ...this.state.answers,
        [questionId]: { ...(this.state.answers[questionId] ?? {}), [playerId]: answer },
      },
    });

    // Everyone's in — no reason to make the room wait out the clock.
    this.maybeAutoLock();
    return ok;
  }

  async placeBet(playerId: string, questionId: string, amount: number): Promise<Result> {
    const player = this.state.players[playerId];
    if (!player) return err("Unknown player");
    if (this.state.phase !== "betting") return err("Betting is closed");

    const question = questionAt(this.state.questionIndex);
    if (!question || question.id !== questionId || question.type !== "bet")
      return err("Stale question");

    if (!Number.isFinite(amount)) return err("Invalid wager");
    // You can never bet more than you have, or less than nothing.
    const wager = Math.round(clampToRange(amount, 0, Math.max(0, player.score)));

    this.patch({
      bets: {
        ...this.state.bets,
        [questionId]: {
          ...(this.state.bets[questionId] ?? {}),
          [playerId]: { playerId, amount: wager, at: Date.now() },
        },
      },
    });
    return ok;
  }

  /** Close the window early once every active player has responded. */
  private maybeAutoLock(): void {
    const question = questionAt(this.state.questionIndex);
    if (!question) return;
    const total = Object.keys(this.state.players).length;
    if (total === 0) return;
    const answered = Object.keys(this.state.answers[question.id] ?? {}).length;
    if (answered >= total) {
      void this.lockAnswers();
    }
  }

  // -------------------------------------------------------------------------
  // Admin actions
  // -------------------------------------------------------------------------

  async startQuestion(): Promise<Result> {
    // From the lobby (or a finished game) this means "start question 1".
    const index =
      this.state.questionIndex < 0 ? 0 : this.state.questionIndex;
    return this.openQuestion(index);
  }

  private async openQuestion(index: number): Promise<Result> {
    const question = questionAt(index);
    if (!question) return err("No such question");
    this.clearTimers();

    const now = Date.now();

    // Opening a question is always a clean run of it. That matters because the
    // admin panel lets you jump to any question in the list: without this, a
    // replayed question would still hold the previous answers, read as
    // "48/48 answered" the instant it opened, and reject every player with
    // "Already answered".
    const cleared = this.clearQuestion(question.id);

    // The bet question opens its wagering window first; the question itself
    // stays hidden until bets lock.
    if (question.type === "bet") {
      this.patch({
        ...cleared,
        phase: "betting",
        questionIndex: index,
        startedAt: now,
        endsAt: now + question.betTimeLimit * 1000,
        pixelStage: 0,
      });
      this.lockTimer = setTimeout(() => {
        void this.lockBets();
      }, question.betTimeLimit * 1000);
      this.onQuestionOpen?.(this.state);
      return ok;
    }

    this.patch({
      ...cleared,
      phase: "question",
      questionIndex: index,
      startedAt: now,
      endsAt: now + question.timeLimit * 1000,
      pixelStage: 0,
    });

    this.lockTimer = setTimeout(() => {
      void this.lockAnswers();
    }, question.timeLimit * 1000);

    // Pixel questions sharpen on their own clock.
    if (question.type === "pixel") {
      this.stageTimer = setInterval(() => {
        const next = this.state.pixelStage + 1;
        if (next >= question.stagePoints.length) {
          if (this.stageTimer) clearInterval(this.stageTimer);
          this.stageTimer = null;
          return;
        }
        this.patch({ pixelStage: next });
      }, question.stageDuration * 1000);
    }

    this.onQuestionOpen?.(this.state);
    return ok;
  }

  /**
   * Wipe a question's answers, bets and score so it can be played again.
   *
   * If the question had already been revealed, the points it awarded are
   * subtracted back off — otherwise replaying question 3 would hand out its
   * points a second time. Because every answer stores the `points` it earned
   * at reveal time, the rollback is exact, including the signed win/loss of
   * the betting round.
   *
   * Returns a state patch rather than applying it, so the caller can fold it
   * into a single broadcast.
   */
  private clearQuestion(questionId: string): Partial<GameState> {
    const answers = this.state.answers[questionId] ?? {};
    const wasScored = this.state.scored.includes(questionId);

    let players = this.state.players;
    if (wasScored) {
      players = { ...players };
      for (const [playerId, answer] of Object.entries(answers)) {
        const points = answer.points ?? 0;
        const player = players[playerId];
        if (!player || points === 0) continue;
        players[playerId] = {
          ...player,
          score: Math.max(0, player.score - points),
        };
      }
    }

    return {
      players,
      answers: { ...this.state.answers, [questionId]: {} },
      bets: { ...this.state.bets, [questionId]: {} },
      scored: this.state.scored.filter((id) => id !== questionId),
    };
  }

  async lockBets(): Promise<Result> {
    if (this.state.phase !== "betting") return err("Not in the betting phase");
    const question = questionAt(this.state.questionIndex);
    if (!question) return err("No question");
    this.clearTimers();

    const now = Date.now();
    this.patch({
      phase: "question",
      startedAt: now,
      endsAt: now + question.timeLimit * 1000,
    });
    this.lockTimer = setTimeout(() => {
      void this.lockAnswers();
    }, question.timeLimit * 1000);
    this.onQuestionOpen?.(this.state);
    return ok;
  }

  async lockAnswers(): Promise<Result> {
    if (this.state.phase !== "question") return err("Nothing to lock");
    this.clearTimers();
    this.patch({ phase: "locked", endsAt: null });
    return ok;
  }

  /**
   * Score the question and reveal the answer. Safe to call from `question`
   * (locks first) and idempotent — a second reveal will not double-score.
   */
  async reveal(): Promise<Result> {
    if (this.state.phase === "question") await this.lockAnswers();
    if (this.state.phase !== "locked" && this.state.phase !== "reveal")
      return err("Nothing to reveal");

    const question = questionAt(this.state.questionIndex);
    if (!question) return err("No question");

    if (this.state.scored.includes(question.id)) {
      this.patch({ phase: "reveal" });
      return ok;
    }

    const answers = this.state.answers[question.id] ?? {};
    const players = { ...this.state.players };
    const ranksBefore = this.rankMap();

    // Snapshot every player's position so the leaderboard can animate the move,
    // including players who scored nothing this round.
    for (const id of Object.keys(players)) {
      players[id] = {
        ...players[id],
        previousScore: players[id].score,
        previousRank: ranksBefore.get(id) ?? null,
      };
    }

    const scoredAnswers: Record<string, Answer> = {};

    if (question.type === "bet") {
      const outcomes = resolveBets(question, this.state.bets[question.id] ?? {}, answers);
      for (const outcome of outcomes) {
        const player = players[outcome.playerId];
        if (!player) continue;
        // Floor at zero — nobody leaves the stage with negative points.
        players[outcome.playerId] = {
          ...player,
          score: Math.max(0, player.score + outcome.delta),
        };
      }
      // Record the delta on the answer so phones can show "won 400".
      for (const outcome of outcomes) {
        const existing = answers[outcome.playerId];
        if (existing) {
          scoredAnswers[outcome.playerId] = { ...existing, points: outcome.delta };
        }
      }
      // Bettors who never guessed still need their loss shown.
      for (const outcome of outcomes) {
        if (!scoredAnswers[outcome.playerId]) {
          scoredAnswers[outcome.playerId] = {
            playerId: outcome.playerId,
            at: Date.now(),
            points: outcome.delta,
          };
        }
      }
    } else {
      const startedAt = this.state.startedAt ?? Date.now();
      for (const [playerId, answer] of Object.entries(answers)) {
        const points = scoreAnswer(question, answer, startedAt);
        scoredAnswers[playerId] = { ...answer, points };
        const player = players[playerId];
        if (player) players[playerId] = { ...player, score: player.score + points };
      }
    }

    this.patch({
      phase: "reveal",
      players,
      answers: { ...this.state.answers, [question.id]: { ...answers, ...scoredAnswers } },
      scored: [...this.state.scored, question.id],
    });
    return ok;
  }

  /** reveal → scores → next question → … → finished */
  async next(): Promise<Result> {
    const { phase, questionIndex } = this.state;
    this.clearTimers();

    if (phase === "lobby") return this.openQuestion(0);

    if (phase === "question" || phase === "locked") {
      // Skipping ahead without an explicit reveal still scores the round.
      return this.reveal();
    }

    if (phase === "reveal") {
      this.patch({ phase: "scores", endsAt: null });
      return ok;
    }

    if (phase === "scores") {
      const nextIndex = questionIndex + 1;
      if (nextIndex >= QUESTIONS.length) {
        this.patch({
          phase: "finished",
          endsAt: null,
          celebrateNonce: this.state.celebrateNonce + 1,
        });
        return ok;
      }
      return this.openQuestion(nextIndex);
    }

    if (phase === "betting") return this.lockBets();
    // `finished` is the end of the run — nothing further to advance to.
    return ok;
  }

  async goToQuestion(index: number): Promise<Result> {
    if (index < 0 || index >= QUESTIONS.length) return err("Out of range");
    return this.openQuestion(index);
  }

  async reset(): Promise<Result> {
    this.clearTimers();
    this.clearBotTimers();
    this.state = freshState();
    this.emit();
    return ok;
  }

  async setMuted(muted: boolean): Promise<Result> {
    this.patch({ muted });
    return ok;
  }

  // -------------------------------------------------------------------------
  // Bots — the implementation lives in ../bots.ts and is injected at runtime
  // -------------------------------------------------------------------------

  async spawnBots(count: number): Promise<Result> {
    const { makeBots } = await import("../bots");
    return makeBots(this, count);
  }

  async removeBots(): Promise<Result> {
    this.clearBotTimers();
    const players = Object.fromEntries(
      Object.entries(this.state.players).filter(([, p]) => !p.isBot),
    );
    this.patch({ players });
    return ok;
  }

  /** Used by the bot driver to insert players without the name-entry flow. */
  public addPlayer(name: string, isBot: boolean): Player {
    const player: Player = {
      id: randomId(isBot ? "bot" : "p"),
      name: this.uniqueName(name),
      score: 0,
      joinedAt: Date.now(),
      isBot,
      previousScore: 0,
      previousRank: null,
    };
    this.patch({ players: { ...this.state.players, [player.id]: player } });
    return player;
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  /** playerId → current 1-based rank. */
  private rankMap(): Map<string, number> {
    const sorted = Object.values(this.state.players).sort(compareForRank);
    return new Map(sorted.map((p, i) => [p.id, i + 1]));
  }
}

// ---------------------------------------------------------------------------
// Small pure helpers
// ---------------------------------------------------------------------------

/** Highest score wins; ties broken by who got there first. */
export function compareForRank(a: Player, b: Player): number {
  if (b.score !== a.score) return b.score - a.score;
  return a.joinedAt - b.joinedAt;
}

export function depthForIndex(questionIndex: number, phase: string): number {
  // Depth advances as each question is completed.
  const completed =
    phase === "finished"
      ? QUESTIONS.length
      : Math.max(0, questionIndex + (phase === "scores" ? 1 : 0));
  return Math.round((completed / QUESTIONS.length) * TOTAL_DEPTH_M);
}

function isValidOption(index: number | undefined, length: number): index is number {
  return typeof index === "number" && Number.isInteger(index) && index >= 0 && index < length;
}

function clampToRange(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

function randomId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}
