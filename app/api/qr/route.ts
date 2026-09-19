/**
 * GET /api/qr?data=<url> → an SVG QR code.
 *
 * Rendered server-side so the projector page stays light, and as SVG so it
 * stays razor sharp when blown up to half a metre on a projector.
 */

import QRCode from "qrcode";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const data = new URL(request.url).searchParams.get("data");
  if (!data) return new Response("Missing ?data", { status: 400 });

  const svg = await QRCode.toString(data, {
    type: "svg",
    margin: 1,
    // High error correction survives a projector's washed-out contrast and
    // someone's hand partially blocking the screen.
    errorCorrectionLevel: "H",
    color: { dark: "#041024", light: "#ffffff" },
  });

  return new Response(svg, {
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "public, max-age=300",
    },
  });
}
