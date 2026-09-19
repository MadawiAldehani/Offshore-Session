"use client";

/**
 * Projector view for a range question.
 *
 * Each player picks a band, and every band contributes to every bucket it
 * covers — so the chart is a COVERAGE profile, not a histogram of values. The
 * peak is where the room collectively agrees the answer lies, and the shoulders
 * show how confident they were about the edges.
 *
 * On reveal the true band drops in as an amber overlay, and it is immediately
 * obvious whether the crowd bracketed it, undershot it, or played it safe by
 * covering half the axis.
 */

import { formatAxis, formatNumber, formatValue } from "@/lib/client/format";
import type { HistogramBucket } from "@/lib/types";

interface Props {
  buckets: HistogramBucket[];
  min: number;
  max: number;
  unit: string;
  thousands: boolean;
  /** Set once revealed. */
  trueMin?: number;
  trueMax?: number;
  answerCount: number;
}

function axisLabel(value: number, thousands: boolean): string {
  return thousands ? formatAxis(value) : formatNumber(value, false);
}

export function RangeChart({
  buckets,
  min,
  max,
  unit,
  thousands,
  trueMin,
  trueMax,
  answerCount,
}: Props) {
  const peak = Math.max(1, ...buckets.map((b) => b.count));
  const revealed = typeof trueMin === "number" && typeof trueMax === "number";
  const span = max - min || 1;

  const bandLeft = revealed ? ((trueMin - min) / span) * 100 : 0;
  const bandWidth = revealed ? ((trueMax - trueMin) / span) * 100 : 0;

  return (
    <div className="w-full">
      <p className="mb-[1.4vh] text-center font-mono text-[1.9vh] uppercase tracking-[0.4em] text-cyan-300/70">
        How many players&apos; ranges cover each depth
      </p>

      <div className="relative h-[32vh] w-full">
        {answerCount === 0 && (
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="font-mono text-[2.2vh] uppercase tracking-[0.35em] text-slate-500">
              Waiting for ranges…
            </p>
          </div>
        )}

        {/* True band sits BEHIND the bars so the overlap reads clearly. */}
        {revealed && (
          <div
            className="absolute inset-y-0 animate-pop-in rounded-[0.6vh] border-x-[0.3vh] border-amber-bright bg-amber-bright/20"
            style={{ left: `${bandLeft}%`, width: `${Math.max(bandWidth, 0.8)}%` }}
          />
        )}

        <div className="absolute inset-0 flex items-end gap-[0.3vw]">
          {buckets.map((bucket, index) => {
            const height = (bucket.count / peak) * 100;
            const inTrueBand =
              revealed && bucket.to > (trueMin as number) && bucket.from < (trueMax as number);
            return (
              <div key={index} className="relative flex h-full flex-1 items-end">
                <div
                  className={`w-full rounded-t-[0.4vh] transition-all duration-500 ease-out ${
                    inTrueBand
                      ? "bg-gradient-to-t from-amber-deep to-amber-bright shadow-[0_0_24px_rgba(255,176,32,0.6)]"
                      : "bg-gradient-to-t from-cyan-deep to-cyan"
                  }`}
                  style={{
                    height: `${height}%`,
                    minHeight: bucket.count > 0 ? "1vh" : "0.25vh",
                    opacity: revealed && !inTrueBand ? 0.45 : 1,
                  }}
                />
              </div>
            );
          })}
        </div>

        {/* Answer callout */}
        {revealed && (
          <div
            className="absolute -top-[6.5vh] animate-pop-in whitespace-nowrap rounded-[1vh] border-2 border-amber-bright bg-abyss/95 px-[1.2vw] py-[0.8vh] text-center"
            style={{ left: `${bandLeft + bandWidth / 2}%`, transform: "translateX(-50%)" }}
          >
            <p className="font-mono text-[1.3vh] uppercase tracking-[0.3em] text-amber-bright/80">
              Answer
            </p>
            <p className="text-[2.8vh] font-black leading-tight text-amber-bright">
              {formatValue(trueMin as number, "", thousands)} –{" "}
              {formatValue(trueMax as number, unit, thousands)}
            </p>
          </div>
        )}
      </div>

      <div className="mt-[1.2vh] flex justify-between border-t-2 border-white/15 pt-[1vh] font-mono text-[1.9vh] text-slate-400">
        <span>{axisLabel(min, thousands)}{unit && unit !== "USD" ? ` ${unit}` : ""}</span>
        <span>{axisLabel(min + span / 2, thousands)}</span>
        <span>{axisLabel(max, thousands)}{unit && unit !== "USD" ? ` ${unit}` : ""}</span>
      </div>
    </div>
  );
}
