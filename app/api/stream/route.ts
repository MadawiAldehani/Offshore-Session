/**
 * Server-Sent Events endpoint — the single real-time channel for all views.
 *
 *   GET /api/stream?view=screen
 *   GET /api/stream?view=admin
 *   GET /api/stream?view=play&playerId=p_abc123
 *
 * Each connection subscribes to the store and pushes its OWN projection, so
 * phones never receive the correct answer ahead of the reveal.
 *
 * Swapping to Supabase: this route disappears entirely — clients would call
 * `supabase.channel('game').on(...)` directly. The `useGameStream` hook on the
 * client is the seam that makes that a one-file change.
 */

import { getStore } from "@/lib/store";
import { projectAdmin, projectPlay, projectScreen } from "@/lib/store/projections";
import type { ClientView, GameState } from "@/lib/types";

// SSE must not be statically rendered or buffered.
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Keeps proxies from closing an idle connection. */
const HEARTBEAT_MS = 15_000;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const view = url.searchParams.get("view") ?? "screen";
  const playerId = url.searchParams.get("playerId");
  const store = getStore();

  const project = (state: GameState): ClientView => {
    switch (view) {
      case "play":
        return projectPlay(state, playerId);
      case "admin":
        return projectAdmin(state);
      default:
        return projectScreen(state);
    }
  };

  const encoder = new TextEncoder();
  let unsubscribe: (() => void) | null = null;
  let heartbeat: ReturnType<typeof setInterval> | null = null;

  const stream = new ReadableStream({
    start(controller) {
      let closed = false;
      // Guards against the (rare) race where the store emits after the client
      // has gone away but before cleanup has run.
      const send = (payload: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(payload));
        } catch {
          closed = true;
        }
      };

      /**
       * Only push when the projected payload actually differs. Without this,
       * an admin panel and a projector would each get a full push for every
       * one of 50 bot answers even when their own view is unchanged.
       */
      let lastSerialised = "";
      const push = (state: GameState) => {
        const projected = project(state);
        // serverNow changes on every projection, so compare without it.
        const { serverNow, ...comparable } = projected;
        const serialised = JSON.stringify(comparable);
        if (serialised === lastSerialised) return;
        lastSerialised = serialised;
        send(`data: ${JSON.stringify(projected)}\n\n`);
      };

      // Send the current state immediately so a late joiner renders at once.
      send(`retry: 2000\n\n`);
      push(store.getState());

      unsubscribe = store.subscribe(push);

      heartbeat = setInterval(() => {
        // A comment frame keeps the socket warm and lets the client
        // re-sync its clock offset without a full payload.
        send(`: ping ${Date.now()}\n\n`);
      }, HEARTBEAT_MS);

      const cleanup = () => {
        closed = true;
        unsubscribe?.();
        if (heartbeat) clearInterval(heartbeat);
        unsubscribe = null;
        heartbeat = null;
      };

      request.signal.addEventListener("abort", () => {
        cleanup();
        try {
          controller.close();
        } catch {
          // Already closed by the runtime — nothing to do.
        }
      });
    },
    cancel() {
      unsubscribe?.();
      if (heartbeat) clearInterval(heartbeat);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      // Disables proxy buffering (nginx and friends), which otherwise holds
      // events back until the buffer fills.
      "X-Accel-Buffering": "no",
    },
  });
}
