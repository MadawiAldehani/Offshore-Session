/**
 * Demo artwork, authored as raw SVG strings.
 * ---------------------------------------------------------------------------
 * Why strings and not JSX? The pixel-reveal question rasterises the image into
 * a <canvas> to pixelate it, which needs a data URL. Keeping one source of
 * truth means the phone, the projector and the canvas all show exactly the
 * same picture — important for the heatmap, where a mismatch would make taps
 * land in the wrong place.
 *
 * Both images use a 4:3 viewBox. Heatmap coordinates are normalised 0..1
 * against that box, so they are resolution-independent.
 */

/**
 * Offshore depth-structure map. The crest — the innermost contour — sits at
 * normalised (0.62, 0.41), which is what questions.ts calls the answer.
 */
export const CONTOUR_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 750" width="1000" height="750">
  <defs>
    <linearGradient id="seabed" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#0a1c33"/>
      <stop offset="100%" stop-color="#061324"/>
    </linearGradient>
    <radialGradient id="high" cx="62%" cy="41%" r="42%">
      <stop offset="0%" stop-color="#1c4f6b" stop-opacity="0.85"/>
      <stop offset="55%" stop-color="#123a53" stop-opacity="0.35"/>
      <stop offset="100%" stop-color="#0a1c33" stop-opacity="0"/>
    </radialGradient>
  </defs>

  <rect width="1000" height="750" fill="url(#seabed)"/>
  <rect width="1000" height="750" fill="url(#high)"/>

  <!-- Survey grid -->
  <g stroke="#1e3a5f" stroke-width="1" opacity="0.5">
    ${gridLines()}
  </g>

  <!-- Depth contours: nested ellipses tightening onto the crest -->
  <g fill="none" stroke="#3f8fb0" stroke-width="2.5" opacity="0.9">
    <ellipse cx="620" cy="307" rx="330" ry="232" transform="rotate(-18 620 307)"/>
    <ellipse cx="620" cy="307" rx="272" ry="188" transform="rotate(-18 620 307)"/>
    <ellipse cx="620" cy="307" rx="214" ry="146" transform="rotate(-18 620 307)"/>
  </g>
  <g fill="none" stroke="#5fb8d6" stroke-width="3" opacity="0.95">
    <ellipse cx="620" cy="307" rx="156" ry="106" transform="rotate(-18 620 307)"/>
    <ellipse cx="620" cy="307" rx="100" ry="68" transform="rotate(-18 620 307)"/>
  </g>
  <!-- Innermost contour = the crest -->
  <ellipse cx="620" cy="307" rx="52" ry="34" transform="rotate(-18 620 307)"
           fill="#0f3a52" fill-opacity="0.55" stroke="#8fe3ff" stroke-width="3.5"/>

  <!-- Depth labels -->
  <g font-family="ui-monospace, Menlo, monospace" font-size="19" fill="#7fc4dd" opacity="0.92">
    <text x="292" y="150">-3200</text>
    <text x="352" y="214">-3000</text>
    <text x="420" y="268">-2800</text>
    <text x="492" y="316">-2600</text>
  </g>

  <!-- A fault cutting the flank, for flavour -->
  <path d="M 120 610 L 330 470 L 520 452 L 700 372 L 900 300" fill="none"
        stroke="#e2703a" stroke-width="3" stroke-dasharray="14 9" opacity="0.8"/>
  <text x="128" y="638" font-family="ui-monospace, Menlo, monospace" font-size="18" fill="#e2703a" opacity="0.85">F-1 FAULT</text>

  <!-- Block label -->
  <g font-family="ui-sans-serif, system-ui, sans-serif" fill="#9fd4e8" opacity="0.75">
    <text x="36" y="52" font-size="26" letter-spacing="3">BLOCK 17/4-A</text>
    <text x="36" y="80" font-size="17" opacity="0.8">TOP RESERVOIR — DEPTH STRUCTURE MAP (m TVDSS)</text>
  </g>

  <!-- Scale bar -->
  <g transform="translate(790 690)">
    <rect x="0" y="0" width="160" height="6" fill="#9fd4e8" opacity="0.8"/>
    <text x="0" y="-10" font-family="ui-monospace, Menlo, monospace" font-size="16" fill="#9fd4e8" opacity="0.8">5 km</text>
  </g>

  <!-- North arrow -->
  <g transform="translate(940 60)" opacity="0.8">
    <path d="M 0 -28 L 9 12 L 0 4 L -9 12 Z" fill="#9fd4e8"/>
    <text x="0" y="34" text-anchor="middle" font-family="ui-sans-serif, system-ui, sans-serif" font-size="17" fill="#9fd4e8">N</text>
  </g>
</svg>`;

function gridLines(): string {
  const lines: string[] = [];
  for (let x = 100; x < 1000; x += 100) lines.push(`<line x1="${x}" y1="0" x2="${x}" y2="750"/>`);
  for (let y = 75; y < 750; y += 75) lines.push(`<line x1="0" y1="${y}" x2="1000" y2="${y}"/>`);
  return lines.join("\n    ");
}

/**
 * Jack-up drilling rig, for the pixel-reveal question. Drawn with big blocks
 * of flat colour and a strong silhouette, because that is what survives being
 * downscaled to 6×5 pixels and still resolves into something recognisable as
 * the image sharpens.
 */
export const JACKUP_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" width="800" height="600">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#1b3a63"/>
      <stop offset="55%" stop-color="#3d6b96"/>
      <stop offset="100%" stop-color="#7ba3c4"/>
    </linearGradient>
    <linearGradient id="water" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#14415f"/>
      <stop offset="100%" stop-color="#07243a"/>
    </linearGradient>
  </defs>

  <rect width="800" height="600" fill="url(#sky)"/>
  <circle cx="126" cy="112" r="44" fill="#ffd79a" opacity="0.85"/>
  <rect y="430" width="800" height="170" fill="url(#water)"/>

  <!-- Three legs punched into the seabed -->
  <g fill="#c9ced6">
    <rect x="196" y="150" width="26" height="420"/>
    <rect x="576" y="150" width="26" height="420"/>
    <rect x="386" y="126" width="26" height="444"/>
  </g>
  <!-- Lattice bracing, the visual signature of a jack-up -->
  <g stroke="#9aa3ae" stroke-width="5" opacity="0.9">
    ${latticeBracing(196, 170, 400)}
    ${latticeBracing(576, 170, 400)}
    ${latticeBracing(386, 146, 420)}
  </g>

  <!-- Hull -->
  <path d="M 150 336 L 650 336 L 618 424 L 182 424 Z" fill="#f0a43a"/>
  <rect x="150" y="318" width="500" height="22" fill="#ffc05a"/>
  <!-- Accommodation block -->
  <rect x="176" y="242" width="132" height="78" fill="#e8edf3"/>
  <g fill="#2f4a68">
    <rect x="190" y="258" width="22" height="18"/><rect x="222" y="258" width="22" height="18"/>
    <rect x="254" y="258" width="22" height="18"/><rect x="190" y="288" width="22" height="18"/>
    <rect x="222" y="288" width="22" height="18"/><rect x="254" y="288" width="22" height="18"/>
  </g>
  <!-- Helideck cantilevered off the bow -->
  <ellipse cx="146" cy="236" rx="74" ry="17" fill="#d8dee6"/>
  <text x="146" y="243" text-anchor="middle" font-family="ui-sans-serif, system-ui, sans-serif"
        font-size="20" font-weight="700" fill="#2f4a68">H</text>

  <!-- Derrick -->
  <path d="M 452 96 L 560 96 L 592 336 L 420 336 Z" fill="#d94f2a" opacity="0.95"/>
  <g stroke="#ffffff" stroke-width="4" opacity="0.55">
    <line x1="452" y1="96" x2="592" y2="336"/>
    <line x1="560" y1="96" x2="420" y2="336"/>
    <line x1="438" y1="200" x2="578" y2="200"/>
    <line x1="428" y1="270" x2="586" y2="270"/>
  </g>
  <rect x="470" y="60" width="72" height="40" fill="#b8391c"/>
  <!-- Crane -->
  <rect x="612" y="250" width="18" height="90" fill="#c9ced6"/>
  <path d="M 618 254 L 742 196" stroke="#c9ced6" stroke-width="11" fill="none"/>

  <!-- Waterline -->
  <g fill="#ffffff" opacity="0.28">
    <rect y="428" width="800" height="7"/>
    <rect x="60" y="452" width="180" height="5"/>
    <rect x="330" y="470" width="240" height="5"/>
    <rect x="520" y="500" width="210" height="5"/>
    <rect x="120" y="520" width="160" height="5"/>
  </g>
</svg>`;

/** X-bracing down the length of a leg, drawn as a run of crossed segments. */
function latticeBracing(x: number, top: number, height: number): string {
  const segments: string[] = [];
  const step = 50;
  const width = 26;
  for (let y = top; y < top + height; y += step) {
    segments.push(`<line x1="${x}" y1="${y}" x2="${x + width}" y2="${y + step}"/>`);
    segments.push(`<line x1="${x + width}" y1="${y}" x2="${x}" y2="${y + step}"/>`);
  }
  return segments.join("\n    ");
}

/** Registry — add your own artwork here and reference it from questions.ts. */
export const ART: Record<string, string> = {
  contour: CONTOUR_SVG,
  jackup: JACKUP_SVG,
};

/**
 * Encode SVG for use as an <img> src. encodeURIComponent (rather than base64)
 * keeps it readable in devtools and avoids any unicode/btoa pitfalls.
 */
export function svgDataUrl(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/**
 * Resolve a question's `image` to something an <img src> can use.
 *
 * A value starting with "/" is treated as a real file under /public and
 * returned untouched; anything else is looked up in the built-in SVG registry.
 */
export function artDataUrl(name: string): string {
  if (name.startsWith("/") || name.startsWith("http")) return name;
  return svgDataUrl(ART[name] ?? CONTOUR_SVG);
}
