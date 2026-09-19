/**
 * Store singleton.
 * ---------------------------------------------------------------------------
 * `getStore()` is the only way the rest of the app reaches game state.
 *
 * To move to Supabase Realtime later, this is the ONLY file that needs to
 * change — swap the constructor for a SupabaseStore that implements the same
 * GameStore interface:
 *
 *     import { SupabaseStore } from "./supabase";
 *     const store = new SupabaseStore(createClient(url, key));
 *
 * Nothing else in the codebase references MemoryStore directly.
 */

import { MemoryStore } from "./memory";
import type { GameStore } from "./types";

/**
 * Next.js dev mode re-evaluates modules on hot reload, which would otherwise
 * hand every reload a brand new (empty) game. Pinning the instance to
 * globalThis keeps players joined across edits — important while you're
 * tweaking the deck with a phone already connected.
 */
const globalForStore = globalThis as unknown as { __offshoreStore?: MemoryStore };

export function getStore(): GameStore {
  if (!globalForStore.__offshoreStore) {
    globalForStore.__offshoreStore = new MemoryStore();
  }
  return globalForStore.__offshoreStore;
}

/**
 * Bots need a couple of methods beyond the portable GameStore surface
 * (inserting players directly, registering timers for cleanup). Keeping this
 * as a separate accessor makes the extra coupling explicit and easy to find
 * when porting.
 */
export function getMemoryStore(): MemoryStore {
  getStore();
  return globalForStore.__offshoreStore as MemoryStore;
}

export type { GameStore } from "./types";
