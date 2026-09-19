/**
 * The store contract.
 * ---------------------------------------------------------------------------
 * Everything the app can do to the game goes through this interface. The demo
 * ships with an in-memory implementation (./memory.ts); a Supabase-backed one
 * only has to satisfy these same methods.
 *
 * Design notes for the future Supabase swap:
 *
 *  - Every mutation is async and returns a Result, so a network round-trip
 *    slots in without changing a single call site.
 *  - `subscribe` takes a plain callback and returns an unsubscribe function —
 *    the same shape as `supabase.channel(...).on(...).subscribe()`.
 *  - Mutations never return the new state. Callers wait for the subscription
 *    to deliver it, exactly as they would with Realtime. This keeps the UI
 *    honest: there is one source of truth and one delivery path.
 *  - `getState()` is the only synchronous method. A Supabase implementation
 *    would serve it from its local cache of the last broadcast snapshot.
 */

import type { GameState } from "../types";

export type Result = { ok: true } | { ok: false; error: string };

export const ok: Result = { ok: true };
export const err = (error: string): Result => ({ ok: false, error });

/** What a client sends when answering. Only the relevant fields are set. */
export interface AnswerInput {
  /** mcq / pixel */
  optionIndex?: number;
  /** multi — every option the player picked */
  optionIndexes?: number[];
  /** slider / bet */
  value?: number;
  /** range — the band the player selected */
  low?: number;
  high?: number;
  /** heatmap, normalised 0..1 */
  x?: number;
  y?: number;
}

export interface GameStore {
  // --- reads ---------------------------------------------------------------
  getState(): GameState;
  /** Fires on every state change. Returns an unsubscribe function. */
  subscribe(listener: (state: GameState) => void): () => void;

  // --- player actions ------------------------------------------------------
  join(name: string): Promise<{ ok: true; playerId: string; name: string } | { ok: false; error: string }>;
  /** Re-attach an existing player id after a refresh. */
  rejoin(playerId: string): Promise<Result>;
  submitAnswer(playerId: string, questionId: string, input: AnswerInput): Promise<Result>;
  placeBet(playerId: string, questionId: string, amount: number): Promise<Result>;

  // --- admin actions -------------------------------------------------------
  /** Open the current question (or the betting window, for a bet question). */
  startQuestion(): Promise<Result>;
  /** Close the betting window early and show the question. */
  lockBets(): Promise<Result>;
  /** Stop accepting answers. */
  lockAnswers(): Promise<Result>;
  /** Score the question and show the answer. */
  reveal(): Promise<Result>;
  /** Advance: reveal → scores → next question (or the finale). */
  next(): Promise<Result>;
  /** Jump straight to a question index. */
  goToQuestion(index: number): Promise<Result>;
  reset(): Promise<Result>;
  setMuted(muted: boolean): Promise<Result>;
  /** Spawn N bot players that answer every question automatically. */
  spawnBots(count: number): Promise<Result>;
  removeBots(): Promise<Result>;
}
