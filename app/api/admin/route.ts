/**
 * POST /api/admin — { action, ...args }
 *
 * One endpoint for every control-panel button. There is deliberately no auth:
 * this is a local demo. Before running it on a real network, put a shared
 * secret or a session check in front of this route.
 */

import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const action = body?.action;
  const store = getStore();

  switch (action) {
    case "start":
      return respond(await store.startQuestion());
    case "lockBets":
      return respond(await store.lockBets());
    case "lock":
      return respond(await store.lockAnswers());
    case "reveal":
      return respond(await store.reveal());
    case "next":
      return respond(await store.next());
    case "goTo":
      return respond(await store.goToQuestion(Number(body.index)));
    case "reset":
      return respond(await store.reset());
    case "mute":
      return respond(await store.setMuted(Boolean(body.muted)));
    case "spawnBots":
      return respond(await store.spawnBots(clampCount(body.count)));
    case "removeBots":
      return respond(await store.removeBots());
    default:
      return Response.json({ error: `Unknown action: ${action}` }, { status: 400 });
  }
}

/** Keep the bot count sane — 200 is already a full auditorium. */
function clampCount(raw: unknown): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return 50;
  return Math.min(200, Math.max(1, Math.round(n)));
}

function respond(result: { ok: boolean } & { error?: string }) {
  if (!result.ok) return Response.json({ error: result.error }, { status: 409 });
  return Response.json({ ok: true });
}
