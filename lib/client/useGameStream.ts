"use client";

/**
 * The client half of the real-time layer.
 * ---------------------------------------------------------------------------
 * Every view calls `useGameStream(...)` and re-renders from what it returns.
 * No component talks to EventSource directly.
 *
 * Swapping to Supabase Realtime: rewrite the body of this hook to subscribe to
 * a channel and setState on broadcast. The returned shape stays identical, so
 * not one component changes.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { AdminView, ClientView, PlayView, ScreenView } from "../types";

type ViewName = "screen" | "play" | "admin";

interface StreamResult<T> {
  data: T | null;
  connected: boolean;
  /**
   * serverTime − clientTime, in ms. Countdown maths adds this so a phone with
   * a skewed clock still shows the same number as the projector.
   */
  clockOffset: number;
}

function useStream<T extends ClientView>(
  view: ViewName,
  playerId?: string | null,
): StreamResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [connected, setConnected] = useState(false);
  const clockOffset = useRef(0);

  useEffect(() => {
    // A play stream without a player id would just deliver `me: null`; wait
    // until we know who we are.
    if (view === "play" && !playerId) return;

    const params = new URLSearchParams({ view });
    if (playerId) params.set("playerId", playerId);

    const source = new EventSource(`/api/stream?${params.toString()}`);

    source.onopen = () => setConnected(true);

    source.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data) as T;
        // Measure drift on every payload. Good enough: the payload arrives a
        // few ms after it was built, which biases the offset by less than the
        // 1s resolution anything on screen actually needs.
        clockOffset.current = payload.serverNow - Date.now();
        setData(payload);
        setConnected(true);
      } catch {
        // A malformed frame is not worth tearing the connection down for.
      }
    };

    source.onerror = () => {
      // EventSource reconnects on its own; just reflect the state in the UI.
      setConnected(false);
    };

    return () => source.close();
  }, [view, playerId]);

  return { data, connected, clockOffset: clockOffset.current };
}

export function useScreenStream() {
  return useStream<ScreenView>("screen");
}

export function useAdminStream() {
  return useStream<AdminView>("admin");
}

export function usePlayStream(playerId: string | null) {
  return useStream<PlayView>("play", playerId);
}

/**
 * Smooth countdown driven by requestAnimationFrame.
 *
 * The server sends an absolute `endsAt`; we render the remainder locally. That
 * means the ring animates at 60fps without the server pushing 60 times a
 * second, and a client that reconnects mid-question picks up in the right
 * place automatically.
 */
export function useCountdown(
  endsAt: number | null,
  clockOffset: number,
): { remainingMs: number; remainingSec: number } {
  const [remainingMs, setRemainingMs] = useState(0);

  useEffect(() => {
    if (!endsAt) {
      setRemainingMs(0);
      return;
    }

    let frame = 0;
    const tick = () => {
      const now = Date.now() + clockOffset;
      setRemainingMs(Math.max(0, endsAt - now));
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [endsAt, clockOffset]);

  return { remainingMs, remainingSec: Math.ceil(remainingMs / 1000) };
}

/**
 * Fires `onFire` once each time `nonce` increases. Used for one-shot effects
 * (confetti, the reveal sting) that are triggered by a counter in the state
 * rather than by a local event.
 */
export function useNonceEffect(nonce: number | undefined, onFire: () => void): void {
  const previous = useRef<number | null>(null);
  const callback = useRef(onFire);
  callback.current = onFire;

  useEffect(() => {
    if (nonce === undefined) return;
    // Record the first value we ever see without firing, so reconnecting
    // mid-game doesn't replay a celebration that already happened.
    if (previous.current === null) {
      previous.current = nonce;
      return;
    }
    if (nonce > previous.current) {
      previous.current = nonce;
      callback.current();
    }
  }, [nonce]);
}

/** Persisted player identity, so a phone refresh doesn't drop you from the game. */
const STORAGE_KEY = "offshore.player";

export interface StoredPlayer {
  playerId: string;
  name: string;
}

export function loadPlayer(): StoredPlayer | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as StoredPlayer) : null;
  } catch {
    return null;
  }
}

export function savePlayer(player: StoredPlayer | null): void {
  if (typeof window === "undefined") return;
  try {
    if (player) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(player));
    else window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Private browsing — the player just has to re-enter their name.
  }
}

/** Convenience wrapper for the POST endpoints. */
export function usePost() {
  return useCallback(async (url: string, body: unknown) => {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(json.error ?? "Request failed");
    return json;
  }, []);
}
