"use client";

/** Full-screen confetti overlay, fired whenever `nonce` increases. */

import { useEffect, useRef } from "react";
import { fireConfetti } from "@/lib/client/confetti";
import { useNonceEffect } from "@/lib/client/useGameStream";

export function Confetti({ nonce }: { nonce: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stopRef = useRef<(() => void) | null>(null);

  useNonceEffect(nonce, () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    stopRef.current?.();
    stopRef.current = fireConfetti(canvas);
  });

  useEffect(() => () => stopRef.current?.(), []);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none absolute inset-0 z-50 h-full w-full"
      aria-hidden="true"
    />
  );
}
