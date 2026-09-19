"use client";

/**
 * Projector side of the heatmap question.
 *
 * Three things animate here:
 *   1. a radar sweep while answers are open, so the screen has motion,
 *   2. a true density heat layer that builds as taps arrive,
 *   3. a cinematic zoom into the field once the answer is out.
 *
 * The board is sized to the ARTWORK's own aspect ratio and the image fills it
 * exactly, so a normalised (x, y) from a phone lands on the same feature here.
 * Getting that wrong is the one bug that would silently mis-score everyone.
 */

import { useEffect, useRef, useState } from "react";
import { artDataUrl } from "@/components/art/svg";

interface Props {
  image: string;
  /** Optional annotated image, faded in once the answer is out. */
  revealImage?: string;
  /** width ÷ height of the artwork. */
  aspect?: number;
  taps: { x: number; y: number }[];
  trueAnswer?: { x: number; y: number };
  /** True while the question is open — drives the radar sweep. */
  sweeping?: boolean;
}

/** How far in the reveal zoom pushes, and when it starts. */
const ZOOM_SCALE = 2.3;
const ZOOM_DELAY_MS = 1700;
const ZOOM_DURATION_MS = 2400;

/** Heat canvas working width. Plenty for a projector, cheap to recolour. */
const HEAT_WIDTH = 900;

export function HeatmapBoard({
  image,
  revealImage,
  aspect = 4 / 3,
  taps,
  trueAnswer,
  sweeping = false,
}: Props) {
  const revealed = Boolean(trueAnswer);
  const heatRef = useRef<HTMLCanvasElement>(null);
  const [zoomed, setZoomed] = useState(false);

  // Hold on the wide shot for a beat so the room sees where the crowd landed,
  // then push in on the field.
  useEffect(() => {
    if (!revealed) {
      setZoomed(false);
      return;
    }
    const timer = setTimeout(() => setZoomed(true), ZOOM_DELAY_MS);
    return () => clearTimeout(timer);
  }, [revealed]);

  // Repaint the heat layer whenever taps change.
  useEffect(() => {
    const canvas = heatRef.current;
    if (!canvas) return;
    const height = Math.round(HEAT_WIDTH / aspect);
    if (canvas.width !== HEAT_WIDTH || canvas.height !== height) {
      canvas.width = HEAT_WIDTH;
      canvas.height = height;
    }
    drawHeat(canvas, taps);
  }, [taps, aspect]);

  return (
    <div
      className="relative mx-auto h-full overflow-hidden rounded-[1.5vh] border-2 border-cyan-400/25 shadow-[0_0_60px_rgba(34,211,238,0.2)]"
      style={{ aspectRatio: String(aspect) }}
    >
      {/* Everything that should move together during the zoom lives in here. */}
      <div
        className="absolute inset-0"
        style={{
          transform: zoomed ? `scale(${ZOOM_SCALE})` : "scale(1)",
          // Zooming about the field's own point pans and scales in one go.
          transformOrigin: trueAnswer
            ? `${trueAnswer.x * 100}% ${trueAnswer.y * 100}%`
            : "center",
          transition: `transform ${ZOOM_DURATION_MS}ms cubic-bezier(0.33, 1, 0.68, 1)`,
        }}
      >
        {/* Base map — the clean one players tap on. */}
        <img src={artDataUrl(image)} alt="" className="h-full w-full object-fill" />

        {/* Annotated map fades in on reveal: the field appears where they pointed. */}
        {revealImage && (
          <img
            src={artDataUrl(revealImage)}
            alt=""
            className="absolute inset-0 h-full w-full object-fill transition-opacity duration-[1200ms] ease-out"
            style={{ opacity: revealed ? 1 : 0 }}
          />
        )}

        {/* Density heat layer. Screen blending keeps the map readable under it. */}
        <canvas
          ref={heatRef}
          className="pointer-events-none absolute inset-0 h-full w-full transition-opacity duration-700"
          style={{ mixBlendMode: "screen", opacity: revealed ? 0.55 : 0.9 }}
        />

        {/* The answer. */}
        {trueAnswer && (
          <div
            className="absolute -translate-x-1/2 -translate-y-1/2 animate-pop-in"
            style={{ left: `${trueAnswer.x * 100}%`, top: `${trueAnswer.y * 100}%` }}
          >
            <div className="absolute left-1/2 top-1/2 h-[9vh] w-[9vh] -translate-x-1/2 -translate-y-1/2 animate-pulse-ring rounded-full border-[0.4vh] border-amber-bright/70" />
            <svg
              viewBox="0 0 24 24"
              className="h-[6vh] w-[6vh] drop-shadow-[0_0_20px_rgba(255,201,77,1)]"
              // Counter-scale so the star stays the same size on screen as the
              // map zooms in underneath it.
              style={{ transform: zoomed ? `scale(${1 / ZOOM_SCALE})` : "scale(1)",
                       transition: `transform ${ZOOM_DURATION_MS}ms cubic-bezier(0.33, 1, 0.68, 1)` }}
            >
              <path
                d="M12 1.5l3.1 6.6 7.2.9-5.3 5 1.4 7.1L12 17.7 5.6 21.1 7 14 1.7 9l7.2-.9z"
                fill="#ffc94d"
                stroke="#04070f"
                strokeWidth="1.1"
              />
            </svg>
          </div>
        )}
      </div>

      {/* Radar sweep — only while the room is still deciding. */}
      {sweeping && !revealed && <RadarSweep />}
    </div>
  );
}

/** Rotating sonar wedge plus expanding range rings. Purely atmospheric. */
function RadarSweep() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <div
        className="absolute left-1/2 top-1/2 aspect-square w-[160%] -translate-x-1/2 -translate-y-1/2 animate-radar-sweep rounded-full"
        style={{
          background:
            "conic-gradient(from 0deg, rgba(34,211,238,0) 0deg, rgba(34,211,238,0.22) 26deg, rgba(34,211,238,0) 52deg)",
        }}
      />
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="absolute left-1/2 top-1/2 aspect-square w-[70%] -translate-x-1/2 -translate-y-1/2 animate-radar-ping rounded-full border border-cyan-300/30"
          style={{ animationDelay: `${i}s` }}
        />
      ))}
    </div>
  );
}

/**
 * Paint the taps as a real density heatmap.
 *
 * Two passes: accumulate greyscale intensity with additive blending so
 * overlapping taps sum, then recolour that intensity through a palette. A
 * plain scatter of dots cannot show where the crowd actually converged.
 */
function drawHeat(canvas: HTMLCanvasElement, taps: { x: number; y: number }[]): void {
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return;

  const { width, height } = canvas;
  context.globalCompositeOperation = "source-over";
  context.clearRect(0, 0, width, height);
  if (taps.length === 0) return;

  // --- Pass 1: intensity ---------------------------------------------------
  context.globalCompositeOperation = "lighter";
  const radius = Math.max(22, width * 0.05);
  for (const tap of taps) {
    const cx = tap.x * width;
    const cy = tap.y * height;
    const gradient = context.createRadialGradient(cx, cy, 0, cx, cy, radius);
    gradient.addColorStop(0, "rgba(255,255,255,0.42)");
    gradient.addColorStop(1, "rgba(255,255,255,0)");
    context.fillStyle = gradient;
    context.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);
  }

  // --- Pass 2: recolour ----------------------------------------------------
  context.globalCompositeOperation = "source-over";
  const image = context.getImageData(0, 0, width, height);
  const data = image.data;
  for (let i = 0; i < data.length; i += 4) {
    const intensity = data[i + 3] / 255;
    if (intensity <= 0.01) {
      data[i + 3] = 0;
      continue;
    }
    const [r, g, b, a] = heatColour(intensity);
    data[i] = r;
    data[i + 1] = g;
    data[i + 2] = b;
    data[i + 3] = a;
  }
  context.putImageData(image, 0, 0);
}

/** Cold blue where a few people tapped, white-hot where the crowd converged. */
function heatColour(t: number): [number, number, number, number] {
  const stops: [number, [number, number, number]][] = [
    [0.0, [12, 74, 110]],    // deep blue
    [0.25, [34, 211, 238]],  // cyan
    [0.5, [163, 230, 53]],   // lime
    [0.75, [255, 176, 32]],  // amber
    [1.0, [255, 255, 255]],  // white hot
  ];
  let lo = stops[0];
  let hi = stops[stops.length - 1];
  for (let i = 0; i < stops.length - 1; i += 1) {
    if (t >= stops[i][0] && t <= stops[i + 1][0]) {
      lo = stops[i];
      hi = stops[i + 1];
      break;
    }
  }
  const span = hi[0] - lo[0] || 1;
  const k = (t - lo[0]) / span;
  const mix = (a: number, b: number) => Math.round(a + (b - a) * k);
  return [
    mix(lo[1][0], hi[1][0]),
    mix(lo[1][1], hi[1][1]),
    mix(lo[1][2], hi[1][2]),
    // Ramp alpha in from nothing so sparse taps glow rather than blot.
    Math.round(Math.min(1, t * 1.9) * 235),
  ];
}
