"use client";

/**
 * Top-10 leaderboard with an animated re-sort.
 *
 * Rows are absolutely positioned and moved with `translateY`, so when the
 * ranking changes React keeps the same DOM node per player (keyed by id) and
 * the browser animates it to its new slot. That is what produces the
 * "rows sliding past each other" effect after the betting round.
 */

import { formatNumber } from "@/lib/client/format";
import type { LeaderboardRow } from "@/lib/types";

interface Props {
  rows: LeaderboardRow[];
  /** Show the points won/lost on the last question. */
  showDelta?: boolean;
  title?: string;
  /** Replace the top three rank numbers with medals (final standings). */
  medals?: boolean;
}

/** Row pitch in vh — must match the row height plus the gap. */
const ROW_PITCH = 7.6;

/** Podium medals, used on the final standings. */
const MEDALS = ["🥇", "🥈", "🥉"];

export function Leaderboard({
  rows,
  showDelta = true,
  title = "Leaderboard",
  medals = false,
}: Props) {
  if (rows.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center">
        <p className="font-mono text-[2.4vh] uppercase tracking-[0.35em] text-slate-500">
          No players yet
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full flex-col">
      <h2 className="mb-[2.4vh] text-center font-mono text-[2.2vh] uppercase tracking-[0.5em] text-cyan-300/80">
        {title}
      </h2>

      <div
        className="relative mx-auto w-full max-w-[64vw]"
        style={{ height: `${rows.length * ROW_PITCH}vh` }}
      >
        {rows.map((row) => (
          <LeaderboardRowView
            key={row.playerId}
            row={row}
            showDelta={showDelta}
            medals={medals}
          />
        ))}
      </div>
    </div>
  );
}

function LeaderboardRowView({
  row,
  showDelta,
  medals,
}: {
  row: LeaderboardRow;
  showDelta: boolean;
  medals: boolean;
}) {
  const movement =
    row.previousRank === null ? 0 : row.previousRank - row.rank; // positive = climbed

  const isPodium = row.rank <= 3;
  const medal = ["#ffd24d", "#cfd8e3", "#d69158"][row.rank - 1];

  return (
    <div
      className="absolute inset-x-0 flex items-center gap-[1.4vw] rounded-[1.2vh] border px-[1.8vw] transition-[transform,background-color,border-color] duration-[900ms] ease-[cubic-bezier(0.22,1,0.36,1)]"
      style={{
        transform: `translateY(${(row.rank - 1) * ROW_PITCH}vh)`,
        height: `${ROW_PITCH - 0.9}vh`,
        borderColor: isPodium ? `${medal}55` : "rgba(255,255,255,0.08)",
        backgroundColor: isPodium ? `${medal}14` : "rgba(255,255,255,0.03)",
      }}
    >
      {/* Rank — a medal for the podium on the final standings. */}
      <span
        className="w-[3.4vw] shrink-0 text-center font-black tabular-nums"
        style={{
          color: isPodium ? medal : "#64748b",
          fontSize: medals && isPodium ? "4.6vh" : "3.4vh",
        }}
      >
        {medals && isPodium ? MEDALS[row.rank - 1] : row.rank}
      </span>

      {/* Movement arrow */}
      <span className="w-[2.2vw] shrink-0 text-center text-[2vh] font-bold tabular-nums">
        {movement > 0 && <span className="text-emerald-400">▲{movement}</span>}
        {movement < 0 && <span className="text-rose-400">▼{-movement}</span>}
        {movement === 0 && <span className="text-slate-600">–</span>}
      </span>

      {/* Name */}
      <span className="min-w-0 flex-1 truncate text-[3.8vh] font-bold text-slate-100">
        {row.name}
      </span>

      {/* Delta from the last question */}
      {showDelta && row.delta !== 0 && (
        <span
          className={`shrink-0 animate-fade-up font-mono text-[2.2vh] font-bold tabular-nums ${
            row.delta > 0 ? "text-emerald-400" : "text-rose-400"
          }`}
        >
          {row.delta > 0 ? "+" : ""}
          {formatNumber(row.delta)}
        </span>
      )}

      {/* Score */}
      <span className="w-[9vw] shrink-0 text-right font-black tabular-nums text-[3.4vh] text-amber-bright">
        {formatNumber(row.score)}
      </span>
    </div>
  );
}
