/**
 * GET /api/info → { joinUrl, host, loopbackOnly }
 *
 * The projector needs a URL that PHONES can actually open.
 *
 * Locally that means substituting the machine's LAN address: if you open
 * /screen on http://localhost:3000 the QR code must not say "localhost",
 * because on a phone that resolves to the phone itself.
 *
 * Deployed, the request already arrives on a public hostname, so we keep it —
 * but we must honour the proxy's protocol header, or the QR would send phones
 * to http:// on a host that only serves https://.
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

  const isLoopback =
    hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";

  // Behind a platform proxy (Railway, Render, Fly, a load balancer) the app
  // itself speaks http while the public URL is https. Trust the forwarded
  // header, and fall back to https for any non-loopback host.
  const forwardedProto = request.headers
    .get("x-forwarded-proto")
    ?.split(",")[0]
    ?.trim();
  const protocol = isLoopback ? "http" : (forwardedProto ?? "https");

  // Only swap in the LAN address when we are actually on a loopback address.
  const lan = isLoopback ? lanAddress() : null;
  const effectiveHost = lan ? `${lan}:${port}` : host;

  return Response.json({
    joinUrl: `${protocol}://${effectiveHost}/play`,
    host: effectiveHost,
    // True when running locally with no reachable LAN address — the UI warns.
    loopbackOnly: isLoopback && !lan,
  });
}
