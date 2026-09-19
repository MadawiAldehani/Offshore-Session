"use client";

/**
 * Event progress rendered as a drill depth: "Drilled to 1,200 m", advancing
 * with each completed question until "TD 3,000 m — Target reached!".
 */

import { formatDepth } from "@/lib/client/format";

interface Props {
  depth: number;
  maxDepth: number;
  questionIndex: number;
  questionCount: number;
}

export function DepthBar({ depth, maxDepth, questionIndex, questionCount }: Props) {
  const fraction = maxDepth > 0 ? Math.min(1, depth / maxDepth) : 0;
  const atTotalDepth = depth >= maxDepth;

  return (
    <div className="w-full">
      <div className="mb-2 flex items-baseline justify-between font-mono text-[1.05vw] uppercase tracking-[0.3em] text-cyan-200/70">
        <span>
          {atTotalDepth ? (
            <span className="text-amber-bright">TD {formatDepth(maxDepth)} — Target reached!</span>
          ) : (
            <>Drilled to <span className="text-slate-100">{formatDepth(depth)}</span></>
          )}
        </span>
        <span>
          {questionIndex >= 0
            ? `Q${Math.min(questionIndex + 1, questionCount)} / ${questionCount}`
            : `${questionCount} questions`}
        </span>
      </div>

      <div className="relative h-[0.9vh] w-full overflow-hidden rounded-full bg-white/10">
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-cyan-deep via-cyan to-amber transition-[width] duration-[1200ms] ease-out"
          style={{ width: `${fraction * 100}%` }}
        />
        {/* Drill bit marker riding the leading edge. */}
        <div
          className="absolute top-1/2 h-[2.2vh] w-[2.2vh] -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-amber bg-abyss shadow-[0_0_20px_rgba(255,176,32,0.9)] transition-[left] duration-[1200ms] ease-out"
          style={{ left: `${fraction * 100}%` }}
        />
      </div>
    </div>
  );
}
