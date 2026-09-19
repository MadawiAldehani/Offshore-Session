"use client";

/**
 * Live histogram of slider guesses.
 *
 * Bars grow as answers arrive. On reveal, a vertical line drops at the true
 * answer and the bars closest to it light up amber.
 */

import { formatAxis, formatNumber, formatValue } from "@/lib/client/format";
import type { HistogramBucket } from "@/lib/types";

/**
 * Axis ticks. Questions with `thousands: false` are counting things that are
 * not quantities — years, most obviously — where compacting 1947 to "1.9k"
 * is actively wrong. Those render in full.
 */
function axisLabel(value: number, thousands: boolean): string {
  return thousands ? formatAxis(value) : formatNumber(value, false);
}

function suffix(unit: string): string {
  // "USD" is rendered as a leading $ by formatValue, so it never trails.
  return unit && unit !== "USD" ? ` ${unit}` : "";
}

interface Props {
  buckets: HistogramBucket[];
  min: number;
  max: number;
  unit: string;
  thousands: boolean;
  /** Set once revealed — drops the true-answer line. */
  trueAnswer?: number;
  answerCount: number;
}

export function Histogram({
  buckets,
  min,
  max,
  unit,
  thousands,
  trueAnswer,
  answerCount,
}: Props) {
  const peak = Math.max(1, ...buckets.map((b) => b.count));
  const revealed = typeof trueAnswer === "number";
  const range = max - min;

  // Which bucket holds the truth, so we can highlight it on reveal.
  const trueBucket = revealed
    ? buckets.findIndex((b, i) =>
        i === buckets.length - 1
          ? trueAnswer >= b.from && trueAnswer <= b.to
          : trueAnswer >= b.from && trueAnswer < b.to,
      )
    : -1;

  const truePosition = revealed && range > 0 ? ((trueAnswer - min) / range) * 100 : 0;

  return (
    <div className="w-full">
      {/* --- Bars ---------------------------------------------------------- */}
      <div className="relative h-[34vh] w-full">
        {answerCount === 0 && (
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="font-mono text-[2.2vh] uppercase tracking-[0.35em] text-slate-500">
              Waiting for guesses…
            </p>
          </div>
        )}

        <div className="flex h-full w-full items-end gap-[0.35vw]">
          {buckets.map((bucket, index) => {
            const height = (bucket.count / peak) * 100;
            const isTrue = index === trueBucket;
            return (
              <div key={index} className="relative flex h-full flex-1 items-end">
                <div
                  className={`w-full rounded-t-[0.5vh] transition-all duration-500 ease-out ${
                    isTrue
                      ? "bg-gradient-to-t from-amber-deep to-amber-bright shadow-[0_0_30px_rgba(255,176,32,0.75)]"
                      : revealed
                        ? "bg-gradient-to-t from-cyan-deep/40 to-cyan/40"
                        : "bg-gradient-to-t from-cyan-deep to-cyan"
                  }`}
                  style={{
                    height: `${height}%`,
                    // A sliver of colour for empty buckets keeps the baseline visible.
                    minHeight: bucket.count > 0 ? "1.2vh" : "0.3vh",
                  }}
                />
                {bucket.count > 0 && (
                  <span className="absolute -top-[2.4vh] left-1/2 -translate-x-1/2 font-mono text-[1.5vh] font-bold tabular-nums text-slate-300">
                    {bucket.count}
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* --- True-answer line, drops in on reveal ------------------------- */}
        {revealed && (
          <div
            className="pointer-events-none absolute inset-y-0"
            style={{ left: `${truePosition}%` }}
          >
            <div className="absolute inset-y-0 w-[0.3vh] origin-top -translate-x-1/2 animate-drop-line bg-amber-bright shadow-[0_0_24px_rgba(255,201,77,0.95)]" />
            <div className="absolute -top-[6.5vh] left-0 -translate-x-1/2 animate-pop-in whitespace-nowrap rounded-[1vh] border-2 border-amber-bright bg-abyss/95 px-[1.2vw] py-[0.8vh] text-center">
              <p className="font-mono text-[1.3vh] uppercase tracking-[0.3em] text-amber-bright/80">
                Answer
              </p>
              <p className="text-[3vh] font-black leading-tight text-amber-bright">
                {formatValue(trueAnswer, unit, thousands)}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* --- Axis ---------------------------------------------------------- */}
      <div className="mt-[1.2vh] flex justify-between border-t-2 border-white/15 pt-[1vh] font-mono text-[1.9vh] text-slate-400">
        <span>{axisLabel(min, thousands)}{suffix(unit)}</span>
        <span>{axisLabel(min + range / 2, thousands)}</span>
        <span>{axisLabel(max, thousands)}{suffix(unit)}</span>
      </div>
    </div>
  );
}
