"use client";

/**
 * Pixel-reveal canvas.
 *
 * The image is drawn tiny into an offscreen canvas, then blown back up with
 * image smoothing OFF — the classic downscale/upscale pixelation. Each stage
 * raises the working resolution, and we interpolate between stages so the
 * picture visibly *sharpens* rather than snapping.
 */

import { useEffect, useRef } from "react";
import { artDataUrl } from "@/components/art/svg";

interface Props {
  image: string;
  stage: number;
  /** After the reveal we render at full resolution. */
  revealed: boolean;
}

/** Working width in pixels for each reveal stage. */
const STAGE_WIDTHS = [7, 16, 38, 90];
const FULL_WIDTH = 900;
const TRANSITION_MS = 900;

export function PixelBoard({ image, stage, revealed }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  /** Current (animated) working width — persists across stage changes. */
  const currentWidth = useRef(STAGE_WIDTHS[0]);
  const frameRef = useRef(0);

  // --- Load the artwork once ------------------------------------------------
  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      imageRef.current = img;
      draw(currentWidth.current);
    };
    img.src = artDataUrl(image);
    return () => {
      img.onload = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [image]);

  /** Render the image at `workingWidth` pixels across, scaled up to fill. */
  const draw = (workingWidth: number) => {
    const canvas = canvasRef.current;
    const img = imageRef.current;
    if (!canvas || !img) return;

    const context = canvas.getContext("2d");
    if (!context) return;

    // Keep the backing store matched to the on-screen size.
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const displayWidth = Math.round(canvas.clientWidth * ratio);
    const displayHeight = Math.round(canvas.clientHeight * ratio);
    if (displayWidth === 0 || displayHeight === 0) return;
    if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
      canvas.width = displayWidth;
      canvas.height = displayHeight;
    }

    const small = Math.max(2, Math.round(workingWidth));
    const smallHeight = Math.max(2, Math.round((small * displayHeight) / displayWidth));

    // Downscale smoothly (averages detail away), then upscale hard-edged.
    const offscreen = document.createElement("canvas");
    offscreen.width = small;
    offscreen.height = smallHeight;
    const offContext = offscreen.getContext("2d");
    if (!offContext) return;
    offContext.imageSmoothingEnabled = true;
    offContext.drawImage(img, 0, 0, small, smallHeight);

    context.imageSmoothingEnabled = false;
    context.clearRect(0, 0, displayWidth, displayHeight);
    context.drawImage(
      offscreen,
      0,
      0,
      small,
      smallHeight,
      0,
      0,
      displayWidth,
      displayHeight,
    );
  };

  // --- Animate to the target resolution whenever the stage advances ---------
  useEffect(() => {
    const target = revealed
      ? FULL_WIDTH
      : (STAGE_WIDTHS[Math.min(stage, STAGE_WIDTHS.length - 1)] ?? STAGE_WIDTHS[0]);
    const from = currentWidth.current;
    const startedAt = performance.now();

    const step = (now: number) => {
      const t = Math.min(1, (now - startedAt) / TRANSITION_MS);
      // Ease-out, interpolated geometrically: resolution doubling feels linear
      // to the eye, so a plain lerp would spend most of the time already sharp.
      const eased = 1 - Math.pow(1 - t, 3);
      const width = from * Math.pow(target / from, eased);
      currentWidth.current = width;
      draw(width);
      if (t < 1) frameRef.current = requestAnimationFrame(step);
    };

    frameRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frameRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, revealed]);

  // --- Keep it crisp when the projector resolution changes -----------------
  useEffect(() => {
    const onResize = () => draw(currentWidth.current);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="relative mx-auto aspect-[4/3] h-full overflow-hidden rounded-[1.5vh] border-2 border-cyan-400/25 bg-abyss shadow-[0_0_60px_rgba(34,211,238,0.2)]">
      <canvas ref={canvasRef} className="h-full w-full" />

      {/* Stage pips, so the room can see the clock is working for them. */}
      {!revealed && (
        <div className="absolute bottom-[1.6vh] left-1/2 flex -translate-x-1/2 gap-[0.8vw]">
          {STAGE_WIDTHS.map((_, index) => (
            <div
              key={index}
              className={`h-[0.9vh] w-[3.2vw] rounded-full transition-all duration-500 ${
                index <= stage ? "bg-amber-bright shadow-[0_0_14px_rgba(255,201,77,0.8)]" : "bg-white/20"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/** Points still on offer at each stage — shown next to the board. */
export function StagePoints({ stagePoints, stage }: { stagePoints: number[]; stage: number }) {
  return (
    <div className="flex flex-col gap-[1vh]">
      {stagePoints.map((points, index) => (
        <div
          key={index}
          className={`flex items-center justify-between gap-[1.2vw] rounded-[1vh] border-2 px-[1.4vw] py-[1vh] transition-all duration-500 ${
            index === stage
              ? "scale-105 border-amber-bright bg-amber-bright/15 text-amber-bright"
              : index < stage
                ? "border-white/10 text-slate-600 line-through"
                : "border-white/15 text-slate-400"
          }`}
        >
          <span className="font-mono text-[1.7vh] uppercase tracking-[0.2em]">
            Stage {index + 1}
          </span>
          <span className="text-[2.6vh] font-black tabular-nums">{points}</span>
        </div>
      ))}
    </div>
  );
}
