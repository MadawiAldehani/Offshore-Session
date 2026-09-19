/**
 * GET /api/info → { joinUrl, host }
 *
 * The projector needs a URL that PHONES can actually open. If you open
 * /screen on http://localhost:3000 the QR code must not say "localhost" —
 * that resolves to the phone itself. So we look up the machine's LAN address
 * and build the join URL from that.
 */

import { networkInterfaces } from "node:os";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** First non-internal IPv4 address — the one phones on the same Wi-Fi can reach. */
function lanAddress(): string | null {
  for (const addresses of Object.values(networkInterfaces())) {
    for (const address of addresses ?? []) {
      if (address.family === "IPv4" && !address.internal) return address.address;
    }
  }
  return null;
}

export async function GET(request: Request) {
  const host = request.headers.get("host") ?? "localhost:3000";
  const port = host.includes(":") ? host.split(":")[1] : "3000";
  const hostname = host.split(":")[0];

  // Only substitute the LAN address when the projector is on a loopback
  // address. If you're already browsing over the network, keep that host.
  const isLoopback =
    hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
  const lan = isLoopback ? lanAddress() : null;
  const effectiveHost = lan ? `${lan}:${port}` : host;

  return Response.json({
    joinUrl: `http://${effectiveHost}/play`,
    host: effectiveHost,
    // True when we could not find a LAN address — the UI warns about it.
    loopbackOnly: isLoopback && !lan,
  });
}
