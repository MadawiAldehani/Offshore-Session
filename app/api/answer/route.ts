/**
 * POST /api/answer
 *   { playerId, questionId, optionIndex? , value?, x?, y? }  → submit an answer
 *   { playerId, questionId, bet: number }                    → place a wager
 */

import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body.playerId !== "string" || typeof body.questionId !== "string") {
    return Response.json({ error: "playerId and questionId are required" }, { status: 400 });
  }

  const store = getStore();
  const { playerId, questionId } = body;

  const result =
    typeof body.bet === "number"
      ? await store.placeBet(playerId, questionId, body.bet)
      : await store.submitAnswer(playerId, questionId, {
          optionIndex: body.optionIndex,
          optionIndexes: body.optionIndexes,
          value: body.value,
          low: body.low,
          high: body.high,
          x: body.x,
          y: body.y,
        });

  if (!result.ok) return Response.json({ error: result.error }, { status: 409 });
  return Response.json({ ok: true });
}
