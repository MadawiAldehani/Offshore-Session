/** POST /api/join — { name } → { playerId, name } */

import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name : "";

  const result = await getStore().join(name);
  if (!result.ok) {
    return Response.json({ error: result.error }, { status: 400 });
  }
  // `name` echoes back the de-duplicated version ("Sam 2"), which the phone
  // shows so the player knows what the projector will call them.
  return Response.json({ playerId: result.playerId, name: result.name });
}
